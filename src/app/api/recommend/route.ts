import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import { profileSummary } from "@/lib/profile";
import { EMPTY_BRAND, brandSummary, mergeBrand, type BrandProfile } from "@/lib/brand";
import { dnaBlock } from "@/lib/visual-prompt";
import { signalBrief, signalCount } from "@/lib/signals";
import { ideaId } from "@/lib/ideas";
import {
  ANGLES,
  CAROUSEL_MAX,
  CAROUSEL_MIN,
  REEL_MAX,
  REEL_MIN,
  publishProblems,
  slideId,
  type AngleId,
  type AssetKind,
  type ContentAsset,
} from "@/lib/assets";
import { findMedia } from "@/lib/media-sources";
import { RECOMMEND_LIMIT, callerKey, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The composer behind the swipe deck.
 *
 * It returns finished, postable assets — every slide's real words, the real
 * caption, the real meme overlay. Anything that comes back describing content
 * rather than being content is dropped here, so a brief can never reach the
 * queue.
 */

interface RecommendRequest {
  brand: BrandProfile;
  count?: number;
  exclude?: string[];
}

interface RawSlide {
  headline?: string;
  body?: string;
  durationMs?: number;
  subject?: string;
  environment?: string;
  shotType?: string;
  styleKeywords?: string[];
}

interface RawAsset {
  kind?: string;
  angle?: string;
  platform?: string;
  caption?: string;
  hashtags?: string[];
  slides?: RawSlide[];
  meme?: { topText?: string; bottomText?: string };
  audioHint?: string;
  why?: string[];
  attrs?: Record<string, string>;
}

const KINDS: AssetKind[] = ["reel", "meme", "carousel"];

/** Spread the batch across formats and angles rather than hoping for variety. */
function plan(count: number): { kind: AssetKind; angle: AngleId }[] {
  const angles = ANGLES.map((a) => a.id);
  return Array.from({ length: count }, (_, i) => ({
    kind: KINDS[i % KINDS.length],
    angle: angles[i % angles.length] as AngleId,
  }));
}

export async function POST(req: Request) {
  const limit = checkRateLimit(callerKey(req), RECOMMEND_LIMIT);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error:
          limit.scope === "global"
            ? "The studio is busy making content. Try again shortly."
            : "Slow down a moment — that is a lot of requests very quickly.",
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: RecommendRequest;
  try {
    body = (await req.json()) as RecommendRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const brand = mergeBrand(EMPTY_BRAND, body.brand);
  const count = Math.min(Math.max(Number(body.count) || 6, 1), 9);
  const seen = Array.isArray(body.exclude) ? body.exclude.slice(-30) : [];
  const taste = signalBrief(brand.prefs.signals ?? {});
  const swipes = signalCount(brand.prefs.signals ?? {});
  const wanted = plan(count);

  const system = [
    "You are a social-media creative producing FINISHED, POSTABLE assets for one brand.",
    "",
    "CRITICAL: never describe content. Write the content itself.",
    '  Wrong: "An educational carousel explaining how AI workers handle invoicing."',
    '  Right: slide 1 headline "You are paying someone to retype invoices", slide 2 ...',
    "  Every slide carries the words that will appear on screen. Every asset has a caption you could paste straight into the app.",
    "",
    "Write like a person who posts, not like an agency. Short lines. Real speech. No 'unlock', 'elevate', 'game-changer', no emoji soup, no hashtag walls.",
    "Humour is allowed and encouraged for meme, POV and relatable angles. Those must be genuinely funny, not corporate-funny.",
    "",
    "FORMATS",
    `- reel: ${REEL_MIN}-${REEL_MAX} beats. Each beat = one on-screen text card over footage, with durationMs (1200-3000). Include audioHint.`,
    "- meme: exactly 1 slide, plus meme.topText and meme.bottomText. Either may be empty but not both. Casual, internet-native.",
    `- carousel: ${CAROUSEL_MIN}-${CAROUSEL_MAX} slides that tell ONE story in sequence; slide 1 stops the scroll, the last one asks for the action.`,
    "",
    "ANGLES",
    ANGLES.map((a) => `- ${a.id}: ${a.brief}`).join("\n"),
    "",
    "Produce exactly these, in this order:",
    wanted.map((w, i) => `${i + 1}. kind=${w.kind}, angle=${w.angle}`).join("\n"),
    "",
    "For every slide also give the shot: subject, environment, shotType, styleKeywords. Describe a real filmable/photographable moment.",
    "'why' is 2-3 short strategist reasons for the brand owner. Never mention prompts, models or your own process.",
    "'attrs' classifies the asset for learning: short lowercase phrases, omit anything that does not apply, never \"n/a\".",
    "",
    "Reply as JSON only:",
    JSON.stringify(
      {
        assets: [
          {
            kind: "reel|meme|carousel",
            angle: "one of the angle ids",
            platform: "Instagram Reels|TikTok|LinkedIn|YouTube Shorts",
            caption: "the real caption",
            hashtags: ["#one", "#two"],
            audioHint: "reels only",
            meme: { topText: "", bottomText: "" },
            slides: [
              {
                headline: "the words on screen",
                body: "optional smaller line",
                durationMs: 2000,
                subject: "",
                environment: "",
                shotType: "",
                styleKeywords: [],
              },
            ],
            why: ["", ""],
            attrs: { contentFormat: "", hookStyle: "", tone: "", topic: "" },
          },
        ],
      },
      null,
      1,
    ),
  ].join("\n");

  const user = [
    "BRAND PROFILE",
    profileSummary(brand.business) || "(sparse)",
    brandSummary(brand),
    "",
    brand.visual.aesthetic ? `BRAND VISUAL DNA\n${dnaBlock(brand.visual)}` : "",
    "",
    taste
      ? `DEMONSTRATED TASTE (from ${swipes} swipe signals)\n${taste}`
      : "DEMONSTRATED TASTE\nNothing yet. Spread widely so their swipes teach us the most.",
    "",
    seen.length ? `ALREADY SHOWN — do not repeat:\n${seen.map((s) => `- ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, temperature: 0.95, maxTokens: 9000 },
    );

    const parsed = parseJsonLoose<{ assets?: RawAsset[] }>(raw);
    const list = Array.isArray(parsed?.assets) ? parsed.assets : [];
    if (!list.length) {
      return NextResponse.json(
        { error: "Nothing usable came back. Try again." },
        { status: 502 },
      );
    }

    const now = Date.now();
    const built: ContentAsset[] = list.map((a, n) => {
      const kind: AssetKind = KINDS.includes(a.kind as AssetKind)
        ? (a.kind as AssetKind)
        : wanted[n]?.kind ?? "carousel";
      const angle = (ANGLES.find((x) => x.id === a.angle)?.id ??
        wanted[n]?.angle ??
        "relatable") as AngleId;

      const rawSlides = Array.isArray(a.slides) ? a.slides : [];
      const slides = (kind === "meme" ? rawSlides.slice(0, 1) : rawSlides).map((s, i) => {
        const mediaQuery = {
          subject: String(s.subject ?? "").trim(),
          environment: String(s.environment ?? "").trim(),
          shotType: String(s.shotType ?? "").trim(),
          styleKeywords: Array.isArray(s.styleKeywords) ? s.styleKeywords.map(String) : [],
        };
        return {
          id: slideId(i),
          headline: String(s.headline ?? "").trim(),
          body: String(s.body ?? "").trim() || undefined,
          durationMs:
            kind === "reel" ? Math.min(4000, Math.max(1200, Number(s.durationMs) || 2200)) : undefined,
          mediaQuery,
          // Reels ask for footage first and fall back to a still when no
          // video source is connected.
          media:
            findMedia({
              ...mediaQuery,
              want: kind === "reel" ? "video" : "image",
              context: brand.business.sector,
            }) ?? undefined,
        };
      });

      return {
        id: ideaId(String(a.caption ?? kind), n),
        kind,
        angle,
        platform: String(a.platform ?? "").trim(),
        caption: String(a.caption ?? "").trim(),
        hashtags: Array.isArray(a.hashtags) ? a.hashtags.map(String).slice(0, 8) : [],
        slides,
        meme:
          kind === "meme"
            ? {
                topText: String(a.meme?.topText ?? "").trim(),
                bottomText: String(a.meme?.bottomText ?? "").trim(),
              }
            : undefined,
        audioHint: kind === "reel" ? String(a.audioHint ?? "").trim() : undefined,
        why: Array.isArray(a.why) ? a.why.map(String).slice(0, 4) : [],
        attrs: (a.attrs ?? {}) as ContentAsset["attrs"],
        createdAt: now,
        updatedAt: now,
      };
    });

    // The gate. A brief must never reach the queue, so anything that fails
    // publishability is dropped rather than shown.
    const assets = built.filter((a) => publishProblems(a).length === 0);
    const rejected = built
      .filter((a) => publishProblems(a).length > 0)
      .map((a) => ({ kind: a.kind, problems: publishProblems(a) }));

    if (!assets.length) {
      return NextResponse.json(
        { error: "Nothing came back finished enough to post. Try again.", rejected },
        { status: 502 },
      );
    }

    return NextResponse.json({ assets, rejected, remaining: limit.remaining });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        { error: "No OpenRouter key. Add OPENROUTER_API_KEY and restart." },
        { status: 503 },
      );
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json(
        { error: `The model refused the request (${err.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Could not reach the model." }, { status: 500 });
  }
}
