import { NextResponse } from "next/server";
import { generateImage, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import { buildIdeaPrompt, buildSlidePrompt, defaultVisual } from "@/lib/visual-prompt";
import { getContentFormat } from "@/lib/ideas";
import { EMPTY_BRAND, mergeBrand, type BrandProfile } from "@/lib/brand";
import { getFormat } from "@/lib/formats";
import { IMAGE_LIMIT, callerKey, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
// Image generation is slow; the default 10s Hobby limit would cut it off.
export const maxDuration = 60;

/**
 * Slide image generation.
 *
 * The prompt is composed server-side from the brand's Visual DNA so the client
 * cannot accidentally drop the constant style layer — that layer is the whole
 * reason a set looks like a set.
 */

interface ImageRequest {
  brand: BrandProfile;
  formatId: string;
  frameIndex: number;
  /** Copy already written for this slide, if any. */
  copy?: string;
  /** Earlier slides from this same carousel, as data URLs. */
  references?: string[];
  /**
   * Set instead of formatId/frameIndex to illustrate a single swipe-deck idea
   * rather than a carousel slide. Same DNA layer either way.
   */
  idea?: {
    hook: string;
    concept?: string;
    visualDirection?: string;
    formatType?: string;
  };
}

export async function POST(req: Request) {
  // Checked before the body is read: a blocked caller should cost nothing.
  const limit = checkRateLimit(callerKey(req), IMAGE_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          limit.scope === "global"
            ? "The studio is generating a lot of images right now. Try again shortly."
            : "That's a lot of images in a short time. Take a breather and try again shortly.",
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: ImageRequest;
  try {
    body = (await req.json()) as ImageRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const brand = mergeBrand(EMPTY_BRAND, body.brand);

  // Fall back to a sane house style rather than refusing when the brand has
  // not described a look yet.
  const dna = brand.visual.aesthetic
    ? brand.visual
    : { ...defaultVisual(brand.business.sector), ...brand.visual };

  let prompt: string;

  if (body.idea?.hook) {
    prompt = buildIdeaPrompt({
      brand,
      dna,
      hook: body.idea.hook,
      concept: body.idea.concept ?? "",
      visualDirection: body.idea.visualDirection ?? "",
      formatLabel: getContentFormat(body.idea.formatType ?? "").label,
    });
  } else {
    const format = getFormat(body.formatId);
    const index = Number(body.frameIndex) || 0;
    const frame = format.frames[index];
    if (!frame) {
      return NextResponse.json({ error: "No such slide." }, { status: 400 });
    }
    prompt = buildSlidePrompt({
      brand,
      dna,
      format,
      frame,
      index,
      total: format.frames.length,
      copy: body.copy,
    });
  }

  try {
    const { dataUrl, model } = await generateImage(prompt, body.references ?? []);
    return NextResponse.json(
      { dataUrl, model, prompt, remaining: limit.remaining },
      { headers: { "X-RateLimit-Remaining": String(limit.remaining) } },
    );
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        { error: "No OpenRouter key. Add OPENROUTER_API_KEY and restart." },
        { status: 503 },
      );
    }
    if (err instanceof UpstreamError) {
      const hint =
        err.status === 402
          ? "OpenRouter is out of credit."
          : `The image model refused the request (${err.status}).`;
      return NextResponse.json({ error: hint }, { status: 502 });
    }
    return NextResponse.json({ error: "Image generation failed." }, { status: 500 });
  }
}
