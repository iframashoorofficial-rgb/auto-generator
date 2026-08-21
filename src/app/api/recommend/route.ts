import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import { profileSummary } from "@/lib/profile";
import { EMPTY_BRAND, brandSummary, mergeBrand, type BrandProfile } from "@/lib/brand";
import { dnaBlock } from "@/lib/visual-prompt";
import { signalBrief, signalCount } from "@/lib/signals";
import { CONTENT_FORMATS, ideaId, type ContentIdea } from "@/lib/ideas";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The recommender behind the swipe deck.
 *
 * It has three inputs that matter: who the brand is, how they look, and what
 * they have swiped. The third is what makes the feed improve — without it this
 * is just a idea generator, and the deck would feel the same on day thirty as
 * on day one.
 */

interface RecommendRequest {
  brand: BrandProfile;
  count?: number;
  /** Hooks already seen this session, so the deck does not repeat itself. */
  exclude?: string[];
}

interface RawIdea {
  hook?: string;
  concept?: string;
  formatType?: string;
  platform?: string;
  visualDirection?: string;
  scenes?: string[];
  cta?: string;
  topic?: string;
  audience?: string;
  tone?: string;
  why?: string[];
  attrs?: Record<string, string>;
}

export async function POST(req: Request) {
  let body: RecommendRequest;
  try {
    body = (await req.json()) as RecommendRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const brand = mergeBrand(EMPTY_BRAND, body.brand);
  const count = Math.min(Math.max(Number(body.count) || 6, 1), 10);
  const seen = Array.isArray(body.exclude) ? body.exclude.slice(-30) : [];
  const taste = signalBrief(brand.prefs.signals ?? {});
  const swipes = signalCount(brand.prefs.signals ?? {});

  const system = [
    "You are a social-media strategist proposing content ideas for one brand.",
    "",
    `Return exactly ${count} ideas as JSON. They must differ from each other in FORMAT, not just in wording —`,
    "a feed of six carousels is a failure. Draw from these formats:",
    CONTENT_FORMATS.map((f) => `- ${f.id} (${f.label}): ${f.brief}`).join("\n"),
    "",
    "Rules:",
    "- Ground every idea in this brand's actual offer, audience and proof. Invent no statistics or claims.",
    "- The hook is one line someone would stop scrolling for. No hashtags, no emoji spam.",
    "- The concept is two sentences: what the piece is, and why it lands.",
    "- 'why' is 2-3 short strategist reasons referencing this brand's real profile and demonstrated taste.",
    "  Write it for the brand owner. Never describe your own reasoning process, models, prompts or scoring.",
    "- 'attrs' is how you would classify the idea, used to learn from their swipes. Use short lowercase phrases.",
    "  Include ONLY the attributes that genuinely apply to the idea and omit the rest entirely.",
    '  Never write "n/a", "none" or "-" — an inapplicable attribute must be left out, not filled in.',
    "- Vary the platform sensibly across ideas (Instagram Reels, TikTok, LinkedIn, YouTube Shorts).",
    "",
    "Each idea:",
    JSON.stringify(
      {
        hook: "",
        concept: "",
        formatType: "one of the format ids above",
        platform: "",
        visualDirection: "how the visual should look, one sentence",
        scenes: ["shot 1", "shot 2"],
        cta: "",
        topic: "",
        audience: "",
        tone: "",
        why: ["reason", "reason"],
        attrs: {
          visualStyle: "", hookStyle: "", contentFormat: "", topic: "",
          tone: "", storytelling: "", creatorStyle: "", textDensity: "",
          ctaStyle: "", videoPacing: "", carouselStructure: "",
        },
      },
      null,
      1,
    ),
    "",
    'Reply as {"ideas": [ ... ]} and nothing else.',
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
      : "DEMONSTRATED TASTE\nNothing yet — this is their first session. Spread the ideas widely across formats so their swipes tell us the most.",
    "",
    seen.length ? `ALREADY SHOWN — do not repeat these hooks:\n${seen.map((s) => `- ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, temperature: 0.9, maxTokens: 7000 },
    );

    const parsed = parseJsonLoose<{ ideas?: RawIdea[] }>(raw);
    const list = Array.isArray(parsed?.ideas) ? parsed.ideas : [];
    if (!list.length) {
      return NextResponse.json(
        { error: "The recommender returned nothing usable. Try again." },
        { status: 502 },
      );
    }

    const validIds = new Set(CONTENT_FORMATS.map((f) => f.id));
    const ideas: ContentIdea[] = list
      .filter((i) => i?.hook)
      .map((i, n) => ({
        id: ideaId(String(i.hook), n),
        hook: String(i.hook).trim(),
        concept: String(i.concept ?? "").trim(),
        // Never trust the model to stay inside the enum.
        formatType: validIds.has(String(i.formatType))
          ? String(i.formatType)
          : CONTENT_FORMATS[n % CONTENT_FORMATS.length].id,
        platform: String(i.platform ?? "").trim(),
        visualDirection: String(i.visualDirection ?? "").trim(),
        scenes: Array.isArray(i.scenes) ? i.scenes.map(String).slice(0, 6) : [],
        cta: String(i.cta ?? "").trim(),
        topic: String(i.topic ?? "").trim(),
        audience: String(i.audience ?? brand.business.audience).trim(),
        tone: String(i.tone ?? brand.business.voice).trim(),
        why: Array.isArray(i.why) ? i.why.map(String).slice(0, 4) : [],
        attrs: (i.attrs ?? {}) as ContentIdea["attrs"],
      }));

    return NextResponse.json({ ideas });
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
