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
import { findMany, pexelsEnabled, toQuery } from "@/lib/pexels";
import {
  BANNED_PHRASES,
  CAPTION_SKELETONS,
  CLIP_VOICE_RULES,
  COMEDY_RULES,
  FUNNY_BAR,
  GENZ_VOICE,
  NATIVE_RULES,
  SLIDE_TEMPLATES,
  densityFor,
  patternsFor,
  reactionFor,
  type CaptionSkeleton,
  type PostPattern,
  type SlideTemplate,
} from "@/lib/comedy";
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

// "clip" leads because it is the format the user actually wants: a licensed
// clip of an ordinary person with a first-person rant over it.
const KINDS: AssetKind[] = ["clip", "meme", "carousel", "reel"];

/**
 * Spread the batch across formats, angles and post patterns.
 *
 * Assigning a recognisable structure up front is what stopped every card
 * sounding like the same competent marketing paragraph. Comic angles are
 * restricted to comic patterns so a meme never gets handed "3 things I wish
 * I knew".
 */
interface PlanItem {
  kind: AssetKind;
  angle: AngleId;
  pattern?: PostPattern;
  /** Carousels get a whole slide-by-slide skeleton. */
  template?: SlideTemplate;
  /** Memes and clips get a viral line shape to transplant into. */
  skeleton?: CaptionSkeleton;
  /** Memes and clips get reaction footage, never a product shot. */
  reaction?: string;
}

function plan(count: number, seed: number): PlanItem[] {
  const angles = ANGLES.map((a) => a.id);
  const comicAngles = new Set(["meme", "pov-joke", "relatable"]);

  return Array.from({ length: count }, (_, i) => {
    const kind = KINDS[i % KINDS.length];
    const angle = angles[(i + seed) % angles.length] as AngleId;

    // A carousel follows a whole argument skeleton; one line of guidance is
    // not enough to hold five slides together.
    if (kind === "carousel") {
      return {
        kind,
        angle,
        template: SLIDE_TEMPLATES[(i + seed) % SLIDE_TEMPLATES.length],
      };
    }

    // Memes and clips transplant a viral line's syntax.
    const skeleton = CAPTION_SKELETONS[(i * 7 + seed) % CAPTION_SKELETONS.length];
    const reaction = reactionFor(i, seed);
    if (kind === "clip") return { kind, angle, skeleton, reaction };

    const options = patternsFor(kind, comicAngles.has(angle));
    const pool = options.length ? options : patternsFor(kind);
    return { kind, angle, skeleton, reaction, pattern: pool[(i + seed) % pool.length] };
  });
}

/** The per-item brief, rendered into the prompt. */
function describe(w: PlanItem, i: number, competitor: string, alternative: string): string {
  const d = densityFor(w.kind);
  const lines = [
    `${i + 1}. kind=${w.kind}, angle=${w.angle}`,
    `     text length: ${d.min}-${d.max} words per block. ${d.note}`,
  ];

  if (w.template) {
    lines.push(`     TEMPLATE "${w.template.id}" — follow slide by slide, in order:`);
    w.template.slides.forEach((s, n) => lines.push(`       slide ${n + 1}: ${s}`));
    lines.push(`     CRITICAL: ${w.template.critical}`);
    if (w.template.id === "competitor-contrast") {
      lines.push(
        competitor
          ? `     Slide 1 names "${competitor}". State no fact about them that was not supplied in the profile.`
          : `     No competitor was named, so contrast with the usual way instead: "${alternative || "the manual process"}". Do not invent a company name.`,
      );
    }
  }

  if (w.pattern) {
    lines.push(`     pattern "${w.pattern.id}": ${w.pattern.template}`);
    lines.push(`     why it lands: ${w.pattern.note}`);
  }

  if (w.reaction) {
    lines.push(
      `     BACKGROUND (use as the slide's "subject", word for word): ${w.reaction}`,
      `       The footage carries the emotion, the text carries the message. Do not describe the product here.`,
    );
  }

  if (w.skeleton) {
    lines.push(
      `     CAPTION SKELETON to transplant: ${w.skeleton.shape}`,
      `       Keep this shape, rhythm and slang. Substitute this brand's situation into the slots.`,
      `       ${w.skeleton.note}`,
    );
  }

  return lines.join("\n");
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
  // Four, not six: composing finished assets is slow, and a batch of six
  // measured over 70s locally — past the 60s serverless ceiling. Four keeps
  // the call inside the limit and the user waiting half as long.
  const count = Math.min(Math.max(Number(body.count) || 4, 1), 6);
  const seen = Array.isArray(body.exclude) ? body.exclude.slice(-30) : [];
  const taste = signalBrief(brand.prefs.signals ?? {});
  const swipes = signalCount(brand.prefs.signals ?? {});
  // Rotate the pattern assignment per batch so a top-up is not a repeat.
  const wanted = plan(count, Math.floor(Date.now() / 60000));

  const system = [
    "You are a social-media creative producing FINISHED, POSTABLE assets for one brand.",
    "",
    "CRITICAL: never describe content. Write the content itself.",
    '  Wrong: "An educational carousel explaining how AI workers handle invoicing."',
    '  Right: slide 1 headline "You are paying someone to retype invoices", slide 2 ...',
    "  Every slide carries the words that will appear on screen. Every asset has a caption you could paste straight into the app.",
    "",
    "Write like a person who posts, not like an agency.",
    "",
    "VOICE — the audience is gen z. this is not optional decoration, it is the whole register.",
    ...GENZ_VOICE.map((r) => `- ${r}`),
    "",
    "THE BAR — apply these tests to your own output before returning it.",
    ...FUNNY_BAR.map((r) => `- ${r}`),
    "",
    "HOW TO BE FUNNY (this is the part that usually fails)",
    ...COMEDY_RULES.map((r) => `- ${r}`),
    "",
    "WRITING A \"clip\" (the rant-over-footage format)",
    ...CLIP_VOICE_RULES.map((r) => `- ${r}`),
    "",
    "HOW TO LOOK NATIVE",
    ...NATIVE_RULES.map((r) => `- ${r}`),
    "",
    `NEVER use these phrases: ${BANNED_PHRASES.join(", ")}.`,
    "",
    "FORMATS",
    `- reel: ${REEL_MIN}-${REEL_MAX} beats. Each beat = one on-screen text card over footage, with durationMs (1200-3000). Include audioHint.`,
    "- meme: exactly 1 slide, plus meme.topText and meme.bottomText. Either may be empty but not both. Casual, internet-native.",
    "  For a meme the slide headline MUST be empty — every visible word lives in meme.topText/bottomText. Describe the picture in subject/environment, never in the headline.",
    "- clip: EXACTLY 1 slide. The headline is a whole first-person rant, 25-70 words, written as short lines. No meme layer, no durations.",
    `- carousel: ${CAROUSEL_MIN}-${CAROUSEL_MAX} slides that tell ONE story in sequence; slide 1 stops the scroll, the last one asks for the action.`,
    "",
    "ANGLES",
    ANGLES.map((a) => `- ${a.id}: ${a.brief}`).join("\n"),
    "",
    "Produce exactly these, in this order. Follow each assigned PATTERN — it is",
    "the recognisable shape that makes a post read as native rather than as an ad:",
    wanted
      .map((w, i) =>
        describe(w, i, brand.business.competitor ?? "", brand.business.alternative),
      )
      .join("\n"),
    "",
    "For every slide also give the shot: subject, environment, shotType, styleKeywords. Describe a real filmable/photographable moment.",
    "BACKGROUNDS FOR meme AND clip: the footage is a REACTION, not the product. A laughing cat, someone with their head in their hands, a person staring at the camera. Never a desk, never a laptop, never the product. Each of those assets is given a reaction subject below — use it verbatim as the slide's 'subject'.",
    "NEVER write stage direction into a headline or body. No 'TOP PANEL:', no 'Slide 2:', no 'Scene:'. Those fields hold the exact words that appear on screen and nothing else.",
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
      // A meme and a clip are both a single frame; only reels and carousels
      // are sequences.
      const single = kind === "meme" || kind === "clip";
      const slides = (single ? rawSlides.slice(0, 1) : rawSlides).map((s, i) => {
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
              // A clip IS footage — a still defeats the whole format.
              want: kind === "reel" || kind === "clip" ? "video" : "image",
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
    // Upgrade the bundled stills to real footage where a stock provider is
    // configured. Done after composition, in one batched pass, so a missing
    // key costs nothing and the route never waits on twenty serial lookups.
    if (pexelsEnabled()) {
      const requests = built.flatMap((a) =>
        a.slides.map((s) => ({
          key: `${a.id}:${s.id}`,
          query: toQuery({ ...s.mediaQuery, context: brand.business.sector }),
          want: (a.kind === "reel" || a.kind === "clip" ? "video" : "image") as
            | "image"
            | "video",
        })),
      );
      const found = await findMany(requests);
      for (const a of built) {
        for (const s of a.slides) {
          const ref = found.get(`${a.id}:${s.id}`);
          if (ref) s.media = ref;
        }
      }
    }

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
