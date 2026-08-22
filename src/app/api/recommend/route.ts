import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError, FAST_MODEL } from "@/lib/openrouter";
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
import { imageRef, videoRef } from "@/lib/media";
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
  type CaptionSkeleton,
  type PostPattern,
  type SlideTemplate,
} from "@/lib/comedy";
import {
  BACKGROUNDS,
  COPY_FORMATS,
  activeAssets,
  copyFormatsForMechanics,
  naturePlates,
  reactionPlates,
  type BackgroundClip,
  type CopyFormat,
  type ReactionPlate,
  type LibraryAsset,
} from "@/lib/meme-library";
import { getTrends, type Trend } from "@/lib/trends";
import { screenConcepts, type Concept } from "@/lib/screen";
import { RECOMMEND_LIMIT, callerKey, checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * How long the concept stage may take before the batch gives up on it.
 *
 * Measured: the write-up call alone is 45-50s for four finished assets, which
 * is most of the 60s ceiling on its own — the route already warned a batch of
 * six ran over 70s. So the shortlist gets whatever is left and no more.
 * Skipping it costs some quality; overrunning costs the entire request.
 */
const CONCEPT_TIMEOUT_MS = 14_000;

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
  /** Background ids used recently, so the pool does not visibly repeat. */
  recentBackgrounds?: string[];
  /**
   * Recently liked cards. Weighted signals shift taste slowly across many
   * swipes; these make a single like land immediately, which is what a person
   * expects after saying "more like this".
   */
  seeds?: { kind?: string; angle?: string; caption?: string; headline?: string }[];
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
  meme?: { slots?: Record<string, string>; topText?: string; bottomText?: string };
  audioHint?: string;
  why?: string[];
  attrs?: Record<string, string>;
}

/** Every kind a card may end up as. Used to validate, not to compose. */
const KINDS: AssetKind[] = ["meme", "clip", "carousel", "reel"];

/** One slot in a batch. */
interface SlotSpec {
  kind: AssetKind;
  /**
   * Meme slots only: which half of the library to draw from.
   *
   * The library holds still templates and reaction clips in one pool, and a
   * meme slot left to pick freely takes either. With five of each, a batch of
   * two meme slots regularly came back with two stills and no video in it at
   * all — which is why the reaction clips looked like they were never being
   * made. Naming the half is what makes "two video memes" mean two video memes.
   */
  asset?: "reaction" | "template";
}

/**
 * What a batch is made of, in the order it is shown.
 *
 * A product decision, not an accident of cycling an array: two reaction clips
 * so the batch has motion in it, one carousel to carry something useful at
 * length, and a fourth slot that is neither — rotated, so a week of batches is
 * not the same four cards with different words.
 *
 * The order matters as much as the mix. The carousel sits BETWEEN the two
 * reactions deliberately: run the two together and the day opens with two cards
 * of the same shape side by side, which reads as one idea shown twice. Split
 * this way, no two neighbours share a style in any of the three rotations.
 */
const BATCH: SlotSpec[] = [
  { kind: "meme", asset: "reaction" },
  { kind: "carousel" },
  { kind: "meme", asset: "reaction" },
  // Placeholder. The real value comes from ROTATION, below.
  { kind: "clip" },
];

/** The fourth slot. Never a reaction, never a carousel. */
const ROTATION: SlotSpec[] = [
  { kind: "clip" },
  { kind: "reel" },
  { kind: "meme", asset: "template" },
];

/** The fourth slot's spec for this batch, rotated by cycle rather than by card. */
function specFor(i: number, seed: number): SlotSpec {
  const at = i % BATCH.length;
  if (at !== BATCH.length - 1) return BATCH[at];
  const cycle = Math.floor(i / BATCH.length);
  return ROTATION[(cycle + seed) % ROTATION.length];
}

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
  /** Clips transplant a viral line's syntax. */
  skeleton?: CaptionSkeleton;
  /** The researched trend this card rides, if one matched. */
  trend?: Trend;
  /**
   * The approved template or reaction clip a meme is built on.
   *
   * Required for a meme. If nothing in the library carries the trend's
   * mechanic the slot becomes a carousel instead — it never falls through to
   * stock footage, which is exactly how the old pipeline produced a random
   * clip of someone laughing for every joke.
   */
  asset?: LibraryAsset;
  /** Text-driven formats: which shape the copy takes, and what plays behind it. */
  copy?: CopyFormat;
  background?: BackgroundClip;
  /** Reactions only: the still the cut-out stands in front of. */
  plate?: ReactionPlate;
}

/**
 * Pick a background, avoiding anything used in this batch or recently.
 *
 * Only one card per batch of four is a clip, so a pool of four gives roughly
 * four batches before a repeat.
 */
function pickBackground(
  used: Set<string>,
  recent: string[],
  seed: number,
  /**
   * Which pool to draw from.
   *
   * Empty landscape, in practice. The peopled clips (bg-01 to bg-04) stay in
   * the library but are no longer selected: a block of copy over footage of
   * somebody else's kitchen competes with itself, and the text lost. They are
   * kept rather than deleted so a card made when they were live still renders.
   */
  plates: BackgroundClip[] = BACKGROUNDS,
): BackgroundClip {
  const free = plates.filter((b) => !used.has(b.id) && !recent.includes(b.id));
  const pool = free.length ? free : plates.filter((b) => !used.has(b.id));
  const from = pool.length ? pool : plates;
  const pick = from[seed % from.length];
  used.add(pick.id);
  return pick;
}

function plan(
  count: number,
  seed: number,
  trends: Trend[],
  recentBackgrounds: string[],
): PlanItem[] {
  const angles = ANGLES.map((a) => a.id);
  const comicAngles = new Set(["meme", "pov-joke", "relatable"]);
  const usedBackgrounds = new Set<string>();
  /**
   * One cursor per half of the library, so all fifteen surface rather than a
   * lucky few. Separate, because a shared cursor advanced by a reaction slot
   * would skip templates it never actually offered.
   */
  const cursors: Record<string, number> = { reaction: 0, template: 0, any: 0 };
  /** Rotates the stills so two reactions in one batch never share a backdrop. */
  let plateCursor = 0;

  return Array.from({ length: count }, (_, i) => {
    const spec = specFor(i, seed);
    let kind = spec.kind;
    const angle = angles[(i + seed) % angles.length] as AngleId;
    // Every slot gets a trend if one is available, not just the second — three
    // of four cards previously rode nothing at all.
    const trend = trends.length ? trends[(i + seed) % trends.length] : undefined;

    if (kind === "clip") {
      // Prefer a copy format that serves this trend's mechanic; otherwise the
      // plain value-copy format, which pairs with topics rather than jokes.
      const matched = trend ? copyFormatsForMechanics(trend.mechanics) : [];
      const copy = matched.length
        ? matched[(i + seed) % matched.length]
        : COPY_FORMATS[0];
      return {
        kind,
        angle,
        copy,
        trend: matched.length ? trend : undefined,
        background: pickBackground(usedBackgrounds, recentBackgrounds, i + seed, naturePlates()),
      };
    }

    if (kind === "meme") {
      /**
       * Asset first, trend second — deliberately the inverse of the original.
       *
       * Picking a trend and then hunting for an asset that carried its mechanic
       * meant the library was only used when the two happened to line up, and
       * the slot silently became a carousel when they did not. Cycling the
       * library instead guarantees every approved template gets its turn, and a
       * trend is layered on only when one genuinely fits. An asset without a
       * matching trend still has its own `shape` to work from, which is the
       * whole reason that field exists.
       */
      const half = spec.asset ?? "any";
      const pool = activeAssets().filter((a) => (spec.asset ? a.kind === spec.asset : true));
      if (pool.length) {
        const asset = pool[(cursors[half]++ + seed) % pool.length];
        const fitted = trends.find((t) =>
          t.mechanics.some((m) => asset.serves.includes(m)),
        );
        return {
          kind,
          angle,
          trend: fitted,
          asset,
          // A reaction floats over ambient footage; a template is its own frame.
          plate:
            asset.kind === "reaction"
              ? reactionPlates()[(plateCursor++ + seed) % reactionPlates().length]
              : undefined,
        };
      }
      // Only reachable if the library is empty, which means something is wrong
      // with the install rather than with this batch.
      kind = "carousel";
    }

    if (kind === "carousel") {
      return {
        kind,
        angle,
        trend,
        template: SLIDE_TEMPLATES[(i + seed) % SLIDE_TEMPLATES.length],
      };
    }

    const skeleton = CAPTION_SKELETONS[(i * 7 + seed) % CAPTION_SKELETONS.length];
    const options = patternsFor(kind, comicAngles.has(angle));
    const pool = options.length ? options : patternsFor(kind);
    return {
      kind,
      angle,
      trend,
      skeleton,
      pattern: pool[(i + seed) % pool.length],
    };
  });
}

/**
 * Stage one: draft many cheap concepts, so there is something to choose from.
 *
 * The old pipeline asked for exactly four finished assets and kept whatever
 * came back — with nothing to select between, quality had no way to rise. This
 * asks a cheap model for three rough angles per slot, which the free
 * deterministic screen then thins before the expensive write-up runs.
 *
 * Returns an empty list on any failure. The caller treats that as "no
 * shortlist" and writes the batch the old way rather than failing the request.
 */
async function draftConcepts(
  wanted: PlanItem[],
  brandLine: string,
  seen: string[],
): Promise<Concept[]> {
  const briefs = wanted
    .map((w, i) => {
      // Field NAMES alone were not enough: the drafter had no idea what
      // "reject" or "trigger" were supposed to contain, so it filled them with
      // whatever fitted the words. Ship the guidance with them.
      const slots = w.asset
        ? w.asset.kind === "template"
          ? w.asset.slots
              .filter((x) => !x.optional)
              .map((x) => `${x.name} (max ${x.maxWords}w) — ${x.guidance}`)
          : w.asset.setupSlots.map((x) => `${x.name} (max ${x.maxWords}w) — ${x.guidance}`)
        : ["line — the whole post"];
      const shape =
        w.asset?.kind === "template"
          ? w.asset.shape
          : w.asset?.kind === "reaction"
            ? `${w.asset.description} It pays off: ${w.asset.reactionTo}`
            : (w.copy?.shape ?? w.pattern?.template ?? "a short post");
      return [
        `${i + 1}. id=${w.asset?.id ?? w.copy?.id ?? w.kind} kind=${w.kind}`,
        `   shape: ${shape}`,
        w.trend ? `   trend: ${w.trend.shape}` : "",
        "   fields:",
        ...slots.map((x) => `     - ${x}`),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const prompt = `BRAND
${brandLine}

Every concept must be about THIS business — its audience, its offering, the
problem it solves. A concept that would work for any company is a failure.

Write TWO distinct concepts for each item below. Fill each field with what that
field asks for; the field guidance is not a suggestion. Vary the angle sharply — three
rewordings of one idea is a failure.

Every concept must contain at least one concrete anchor: a number, a price, a
time, a day, or a named thing. "admin is annoying" is filler; "a spreadsheet
named final_FINAL_v3" is a joke.

${briefs}

${seen.length ? `Already used, do not repeat:\n${seen.slice(-12).map((x) => `- ${x}`).join("\n")}
` : ""}
Return {"concepts":[{"assetId":"...","text":{"<field>":"..."},"why":"one clause"}]} and nothing else.`;

  // Hard-capped, and deliberately give-up-able. Measured end to end at 50-66s
  // against a 60s ceiling, and the write-up is the part that cannot be skipped
  // — so if the shortlist is slow, the batch proceeds without one rather than
  // taking the whole request over the limit.
  const budget = new Promise<null>((resolve) => setTimeout(() => resolve(null), CONCEPT_TIMEOUT_MS));

  try {
    const raw = await Promise.race([
      chat(
        [
          {
            role: "system",
            content:
              "You draft rough meme concepts. Short, specific, internet-native. Never corporate. Output JSON only.",
          },
          { role: "user", content: prompt },
        ],
        { json: true, model: FAST_MODEL, temperature: 1, maxTokens: 1500 },
      ),
      budget,
    ]);
    if (!raw) return [];
    const parsed = parseJsonLoose<{ concepts?: Concept[] }>(raw);
    return Array.isArray(parsed?.concepts) ? parsed.concepts : [];
  } catch {
    return [];
  }
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

  if (w.trend) {
    lines.push(
      `     TREND "${w.trend.id}" — researched, current. Build this one on it:`,
      `       ${w.trend.shape}`,
      `       why it is working: ${w.trend.note}`,
      `       Take the STRUCTURE only. Never reproduce anyone's actual post, wording or subject.`,
    );
  }

  if (w.asset) {
    if (w.asset.kind === "template") {
      lines.push(`     TEMPLATE "${w.asset.id}" — the artwork is fixed; fill its slots:`);
      lines.push(`       ${w.asset.shape}`);
      if (w.asset.bakedText) {
        lines.push(
          `       ALREADY DRAWN ON THE IMAGE: "${w.asset.bakedText}". Do not repeat or contradict it.`,
        );
      }
      for (const slot of w.asset.slots) {
        lines.push(
          `       slot "${slot.name}"${slot.optional ? " (optional)" : ""}: ${slot.guidance} Max ${slot.maxWords} words.`,
        );
      }
      lines.push(
        `       Return these in meme.slots keyed by slot name. Leave the slide headline EMPTY.`,
      );
    } else {
      lines.push(`     REACTION CLIP "${w.asset.id}" — the punchline is the footage:`);
      lines.push(`       what it shows: ${w.asset.description}`);
      lines.push(`       it pays off: ${w.asset.reactionTo}`);
      if (w.asset.spokenLine) {
        lines.push(
          `       the clip already says "${w.asset.spokenLine}" — it plays muted, so do not rely on it being heard, and do not repeat it.`,
        );
      }
      for (const beat of w.asset.setupSlots) {
        lines.push(`       beat "${beat.name}": ${beat.guidance} Max ${beat.maxWords} words.`);
      }
      lines.push(
        `       Return these in meme.slots keyed by beat name. Leave the slide headline EMPTY.`,
        `       The text is the SETUP only. Never describe the clip — the viewer can see it.`,
      );
    }
  }

  if (w.copy) {
    lines.push(
      `     COPY FORMAT "${w.copy.id}": ${w.copy.shape}`,
      `       ${w.copy.minLines}-${w.copy.maxLines} short lines, ${w.copy.minWords}-${w.copy.maxWords} words total.`,
      ...w.copy.rules.map((r) => `       - ${r}`),
      `       Put the whole thing in the slide headline, one line per line, blank lines between sections.`,
      `       The footage behind it is unrelated ambient video. Never reference it.`,
    );
  }

  if (w.pattern) {
    lines.push(`     pattern "${w.pattern.id}": ${w.pattern.template}`);
    lines.push(`     why it lands: ${w.pattern.note}`);
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
  /**
   * Three, not four.
   *
   * Measured 22 Aug 2026 with the two-stage pipeline: writing four finished
   * assets alone takes 45-50s of the 60s ceiling, which left no room for the
   * concept stage — it timed out on every request and the screening never ran.
   * Three assets complete in ~47s *including* concepts and screening.
   *
   * Costs nothing in practice: the deck tops up in the background against
   * LOW_WATER, so a smaller batch just means one more quiet top-up.
   */
  const count = Math.min(Math.max(Number(body.count) || 4, 1), 6);
  const seen = Array.isArray(body.exclude) ? body.exclude.slice(-30) : [];
  const seeds = Array.isArray(body.seeds) ? body.seeds.slice(-3) : [];
  const taste = signalBrief(brand.prefs.signals ?? {});
  const swipes = signalCount(brand.prefs.signals ?? {});
  const recentBackgrounds = Array.isArray(body.recentBackgrounds)
    ? body.recentBackgrounds.slice(-6)
    : [];
  // Researched, cached for six hours, and empty is a valid answer — a slot with
  // no trend simply falls back to an evergreen pattern.
  const trends = await getTrends();
  // Rotate the pattern assignment per batch so a top-up is not a repeat.
  const wanted = plan(count, Math.floor(Date.now() / 60000), trends, recentBackgrounds);

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
    "- meme: exactly 1 slide. Every visible word goes in meme.slots, keyed by the slot or beat names given for that item. The slide headline MUST be empty.",
    "  The artwork is already chosen and fixed. Do NOT describe a picture — subject/environment are ignored for memes.",
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
    "BACKGROUNDS FOR clip: the footage is a REACTION, not the product. A laughing cat, someone with their head in their hands, a person turning to the camera. Never a desk, never a laptop, never the product. Use the reaction subject given below verbatim as the slide's 'subject'.",
    "BACKGROUNDS FOR meme: two separate pictures. The slide 'subject' is the BACKDROP — a plain, calm, unpeopled scene (a wall, a sky, a road, a room) that the text and the reaction panel sit over. The reaction clip is chosen separately, so do not describe it in the subject.",
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
    seeds.length
      ? [
          "THEY LIKED THESE — make more in this vein:",
          ...seeds.map(
            (s) =>
              `- [${s.kind ?? "?"} / ${s.angle ?? "?"}] ${(s.headline || s.caption || "").slice(0, 160)}`,
          ),
          "",
          "Take what made those work — the format, the angle, the kind of joke, the level of specificity — and apply it to DIFFERENT material.",
          "A near-copy is a failure: change the subject, the situation and the punchline. Same energy, new post.",
          "At least half of this batch should follow that vein; keep the rest varied so the deck does not narrow to one idea.",
        ].join("\n")
      : "",
    "",
    seen.length ? `ALREADY SHOWN — do not repeat:\n${seen.map((s) => `- ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Stage one: many cheap concepts. Stage two: throw the generic ones out for
  // free. Only what survives is worth the expensive write-up.
  const drafted = await draftConcepts(
    wanted,
    // The drafter was only given a one-line summary, so its concepts came back
    // about small businesses in general rather than about THIS one. It needs
    // the same profile the write-up gets.
    [profileSummary(brand.business) || "(sparse)", brandSummary(brand)].filter(Boolean).join("\n"),
    seen,
  );
  const limits: Record<string, Record<string, number>> = {};
  for (const w of wanted) {
    if (w.asset?.kind === "template") {
      limits[w.asset.id] = Object.fromEntries(w.asset.slots.map((x) => [x.name, x.maxWords]));
    } else if (w.asset?.kind === "reaction") {
      limits[w.asset.id] = Object.fromEntries(w.asset.setupSlots.map((x) => [x.name, x.maxWords]));
    }
  }
  const screened = screenConcepts(drafted, { exclude: seen, limits });

  const shortlist = screened.kept.length
    ? [
        "",
        "SHORTLIST — these concepts already passed the specificity screen.",
        "Pick the strongest for each item and write it up properly. You may sharpen",
        "the wording; do not replace a concept with a vaguer one.",
        ...screened.kept.map(
          (c) => `- [${c.assetId}] ${Object.entries(c.text).map(([k, v]) => `${k}: ${v}`).join(" | ")}`,
        ),
      ].join("\n")
    : "";

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: shortlist ? `${user}\n${shortlist}` : user },
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
      /**
       * The plan decides the format; the model only fills it.
       *
       * The model is handed a kind and used to be believed over the plan, so a
       * slot specified as a reaction meme quietly became a carousel whenever
       * the writer preferred one — which is how a batch composed as two video
       * memes came back with none. It is told what to write, not asked what
       * format it fancies. The model's answer is still the fallback for a slot
       * the plan somehow left unset.
       */
      const kind: AssetKind =
        wanted[n]?.kind ??
        (KINDS.includes(a.kind as AssetKind) ? (a.kind as AssetKind) : "carousel");
      const angle = (ANGLES.find((x) => x.id === a.angle)?.id ??
        wanted[n]?.angle ??
        "relatable") as AngleId;

      const slot = wanted[n];
      /**
       * The frame behind the text, taken from the library rather than searched.
       * A template supplies its own artwork; a reaction floats over ambient
       * footage; a text-driven clip plays its assigned background.
       */
      const memeMedia =
        slot?.asset?.kind === "template"
          ? imageRef(slot.asset.file, "stock", slot.asset.name)
          : slot?.plate
            ? imageRef(slot.plate.file, "stock", slot.plate.description)
            : slot?.background
              ? videoRef(slot.background.file, undefined, "stock")
              : undefined;

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
          // A meme's visual is never searched for. It is the approved
          // template's artwork, or the ambient background a reaction floats
          // over. Searching here is what produced a stock clip of someone
          // laughing for every joke.
          media: memeMedia
            ? memeMedia
            : findMedia({
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
                templateId: wanted[n]?.asset?.id,
                slots: Object.fromEntries(
                  Object.entries((a.meme?.slots ?? {}) as Record<string, unknown>).map(
                    ([k, v]) => [k, String(v ?? "").trim()],
                  ),
                ),
                // A reaction asset is the picture-in-picture punchline; a
                // template is the frame itself and has no inset.
                reaction:
                  wanted[n]?.asset?.kind === "reaction"
                    ? videoRef(wanted[n]!.asset!.file, undefined, "stock")
                    : undefined,
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
      // Memes and text-driven clips are dressed from the library above, so they
      // are excluded here entirely — no meme ever reaches a stock search now.
      const fromLibrary = new Set(
        built
          .filter((a, n) => wanted[n]?.asset || wanted[n]?.background || wanted[n]?.plate)
          .map((a) => a.id),
      );
      const requests = built.filter((a) => !fromLibrary.has(a.id)).flatMap((a) => [
        // The meme's inset is a second, separate lookup: the background and
        // the reaction are deliberately different pictures.
        ...a.slides.map((s) => ({
          key: `${a.id}:${s.id}`,
          query: toQuery({
            ...s.mediaQuery,
            context: brand.business.sector,
            // Carousels and reels should look like this business. Memes and
            // clips deliberately should not — their footage is a reaction.
            boost:
              a.kind === "carousel" || a.kind === "reel"
                ? `${brand.business.sector} ${brand.business.offering}`
                : "",
          }),
          want: (a.kind === "reel" || a.kind === "clip" ? "video" : "image") as
            | "image"
            | "video",
        })),
      ]);
      const found = await findMany(requests);
      for (const a of built) {
        for (const s of a.slides) {
          const ref = found.get(`${a.id}:${s.id}`);
          if (ref) s.media = ref;
        }
        const inset = found.get(`${a.id}:reaction`);
        if (inset && a.meme) a.meme.reaction = inset;
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

    return NextResponse.json({
      assets,
      rejected,
      // What the free screen removed before anything was paid for.
      screened: { drafted: drafted.length, kept: screened.kept.length, dropped: screened.dropped },
      trends: trends.map((t) => t.id),
      remaining: limit.remaining,
    });
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
