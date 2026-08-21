/**
 * Finished assets.
 *
 * The deck used to hold *ideas* — "an educational piece explaining X" — which
 * is a brief, not something anyone can post. An asset is the finished thing:
 * every slide's real text, the real caption, the real overlay. If a card
 * cannot be exported and posted, `isPublishable` rejects it before it ever
 * reaches the queue.
 *
 * The model may still think in ideas internally. It just may not hand one over.
 */

import type { MediaRef } from "./media";
import type { SignalAttr } from "./signals";
import type { VisualMeta } from "./ideas";

export type AssetKind = "reel" | "meme" | "carousel" | "clip";

/**
 * The editorial angle, kept separate from the format.
 *
 * Variety failed before because every card was "educational". Angle is what
 * stops six carousels all sounding like a whitepaper.
 */
export const ANGLES = [
  { id: "meme", label: "Meme", brief: "A recognisable internet format aimed at this audience's specific pain. Funny first." },
  { id: "pov-joke", label: "POV joke", brief: "A 'POV:' setup that lands a joke the audience lives every week." },
  { id: "relatable", label: "Relatable work moment", brief: "A small true situation the audience will tag a colleague in." },
  { id: "educational", label: "Teach something", brief: "One genuinely useful thing, concrete and immediately usable." },
  { id: "hot-take", label: "Hot take", brief: "A defensible opinion the brand will actually stand behind." },
  { id: "founder-observation", label: "Founder observation", brief: "Something only someone running this business would notice." },
  { id: "proof", label: "Proof / result", brief: "A real, checkable outcome told plainly." },
] as const;

export type AngleId = (typeof ANGLES)[number]["id"];

/** One panel: a carousel slide, a reel beat, or the single meme frame. */
export interface AssetSlide {
  id: string;
  /** Big on-screen type. Required — a slide without words is not finished. */
  headline: string;
  /** Optional supporting line. */
  body?: string;
  /** What this panel should show, used to select or generate media. */
  mediaQuery: VisualMeta;
  /** The actual asset. Stock still today; a clip when a source exists. */
  media?: MediaRef;
  /** Reels only: how long this beat holds, in milliseconds. */
  durationMs?: number;
}

export interface MemeLayer {
  /** Classic top/bottom meme text. Either may be empty, not both. */
  topText: string;
  bottomText: string;
  /** Optional reaction image layered over the background. */
  reaction?: MediaRef;
}

export interface ContentAsset {
  id: string;
  kind: AssetKind;
  angle: AngleId;
  platform: string;
  /** The caption you would actually paste into the post. */
  caption: string;
  hashtags: string[];
  /** 1 for a meme, 3-6 beats for a reel, 4-7 slides for a carousel. */
  slides: AssetSlide[];
  meme?: MemeLayer;
  /** Reels only: the sound direction, e.g. "trending upbeat, no vocals". */
  audioHint?: string;
  /** Strategist reasons. Never internal reasoning. */
  why: string[];
  attrs: Partial<Record<SignalAttr, string>>;
  decided?: "like" | "pass";
  edited?: boolean;
  createdAt: number;
  updatedAt: number;
}

export const CAROUSEL_MIN = 4;
export const CAROUSEL_MAX = 7;
export const REEL_MIN = 3;
export const REEL_MAX = 6;
/** The rant-over-a-clip format lives or dies on being long enough to read as
 *  a real person venting rather than a caption. */
export const CLIP_MIN_WORDS = 25;
export const CLIP_MAX_WORDS = 70;

function wordCount(s: string | undefined): number {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The gate.
 *
 * Returns the reasons an asset is not postable. Empty means it may enter the
 * queue. Deliberately strict about text: a "slide" with no words is a brief.
 */
export function publishProblems(a: ContentAsset): string[] {
  const problems: string[] = [];
  const hasText = (s: string | undefined) => !!s && s.trim().length > 1;

  if (!hasText(a.caption)) problems.push("no caption");
  if (!a.slides.length) problems.push("no slides");

  if (a.kind === "carousel") {
    if (a.slides.length < CAROUSEL_MIN || a.slides.length > CAROUSEL_MAX) {
      problems.push(`carousel needs ${CAROUSEL_MIN}-${CAROUSEL_MAX} slides, has ${a.slides.length}`);
    }
    if (a.slides.some((s) => !hasText(s.headline))) problems.push("a slide has no headline");
  }

  if (a.kind === "reel") {
    if (a.slides.length < REEL_MIN || a.slides.length > REEL_MAX) {
      problems.push(`reel needs ${REEL_MIN}-${REEL_MAX} beats, has ${a.slides.length}`);
    }
    if (a.slides.some((s) => !hasText(s.headline))) problems.push("a beat has no on-screen text");
    if (a.slides.some((s) => !s.durationMs || s.durationMs < 600)) {
      problems.push("a beat has no usable duration");
    }
  }

  if (a.kind === "clip") {
    // One clip, one rant. The whole format is a single text block laid over
    // unrelated footage, so a "clip" with five slides is a reel by mistake.
    if (a.slides.length !== 1) {
      problems.push(`clip needs exactly 1 text block, has ${a.slides.length}`);
    }
    const words = wordCount(a.slides[0]?.headline) + wordCount(a.slides[0]?.body);
    if (words < CLIP_MIN_WORDS) {
      problems.push(`clip text is too short (${words} words, needs ${CLIP_MIN_WORDS}+)`);
    }
    if (words > CLIP_MAX_WORDS) {
      problems.push(`clip text is too long (${words} words, max ${CLIP_MAX_WORDS})`);
    }
    // The voice is the format. Sentence case means it was written as an ad.
    const text = `${a.slides[0]?.headline ?? ""} ${a.slides[0]?.body ?? ""}`;
    if (/[.!?]\s*$/.test(text.trim())) {
      problems.push("clip text ends with punctuation — this format does not");
    }
  }

  if (a.kind === "meme") {
    const m = a.meme;
    if (!m || (!hasText(m.topText) && !hasText(m.bottomText))) {
      problems.push("meme has no overlay text");
    }
  }

  // The tell-tales of a brief rather than an asset.
  const briefish = /^(an?|the)\s+(educational|informative|engaging)\b|piece (that|explaining)|content that|a post (about|explaining)/i;
  if (a.slides.some((s) => briefish.test(s.headline))) {
    problems.push("a slide describes the content instead of being it");
  }

  // Stage direction: notes to a designer, not words anyone would see on screen.
  const direction = /\b(top|bottom|left|right|first|second|third|final)\s+(panel|frame|image|half)\b|^(panel|slide|frame|shot|image|scene|caption|text)\s*\d*\s*:/i;
  if (a.slides.some((s) => direction.test(s.headline) || direction.test(s.body ?? ""))) {
    problems.push("a slide contains stage direction instead of on-screen text");
  }

  return problems;
}

export function isPublishable(a: ContentAsset): boolean {
  return publishProblems(a).length === 0;
}

/** Total runtime of a reel. */
export function reelDuration(a: ContentAsset): number {
  return a.slides.reduce((n, s) => n + (s.durationMs ?? 0), 0);
}

export function assetLabel(kind: AssetKind): string {
  if (kind === "reel") return "Reel";
  if (kind === "meme") return "Meme";
  if (kind === "clip") return "Clip";
  return "Carousel";
}

export function angleLabel(id: AngleId): string {
  return ANGLES.find((a) => a.id === id)?.label ?? id;
}

export function slideId(i: number): string {
  return `s${i}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Is this a ContentAsset, and not something older?
 *
 * The deck persists across releases, so a browser can hold cards saved before
 * assets existed — those had `hook`/`concept` and no `slides`, and rendering
 * one throws on hydration. Anything that does not match the current shape is
 * dropped on load rather than crashing the page.
 */
export function isContentAsset(value: unknown): value is ContentAsset {
  if (!value || typeof value !== "object") return false;
  const a = value as Partial<ContentAsset>;
  return (
    typeof a.id === "string" &&
    typeof a.caption === "string" &&
    (a.kind === "reel" ||
      a.kind === "meme" ||
      a.kind === "carousel" ||
      a.kind === "clip") &&
    Array.isArray(a.slides) &&
    a.slides.every((s) => s && typeof s === "object" && typeof s.headline === "string")
  );
}
