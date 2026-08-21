/**
 * Weighted preference signals.
 *
 * The existing `liked` / `disliked` lists on ContentPrefs are free text — good
 * for pasting into a prompt, useless for deciding whether a taste is settled.
 * Swiping produces far more data than clicking a thumb, so it needs weights:
 * one swipe is a hint, five swipes the same way is a rule.
 *
 * Deliberately additive. Nothing here replaces ContentPrefs, so a brand saved
 * before this existed keeps working and simply starts with no signals.
 */

/** The attributes a swipe teaches us about. */
export const SIGNAL_ATTRS = [
  "visualStyle",
  "hookStyle",
  "contentFormat",
  "topic",
  "tone",
  "storytelling",
  "creatorStyle",
  "textDensity",
  "ctaStyle",
  "videoPacing",
  "carouselStructure",
] as const;

export type SignalAttr = (typeof SIGNAL_ATTRS)[number];

/** attribute -> value -> weight. Positive is liked, negative is disliked. */
export type SignalMap = Partial<Record<SignalAttr, Record<string, number>>>;

/**
 * Weights are clamped rather than unbounded.
 *
 * A single left swipe must never permanently exclude something — a user may
 * dislike one execution of an idea they like in general. Clamping means taste
 * can always be reversed by swiping the other way a few times.
 */
export const MAX_WEIGHT = 4;
const LIKE_STEP = 1;
const DISLIKE_STEP = -1;

/** Values with |weight| at or above this are treated as settled taste. */
export const STRONG = 2;

const clamp = (n: number) => Math.max(-MAX_WEIGHT, Math.min(MAX_WEIGHT, n));

/** Normalise so "Founder POV" and "founder pov" are the same taste. */
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

/**
 * Placeholders a model emits for an attribute that does not apply.
 *
 * Learning these would be worse than learning nothing: after a few swipes the
 * brief would earnestly report that the user consistently likes "n/a".
 */
const JUNK = new Set(["n/a", "na", "none", "-", "–", "unknown", "null", "undefined", ""]);

function isJunk(value: string): boolean {
  return JUNK.has(norm(value));
}

/**
 * Fold one swipe into the map.
 *
 * `attrs` is whatever the card actually declared; absent attributes are simply
 * not learned from, which keeps a sparse idea from teaching us noise.
 */
export function reinforce(
  base: SignalMap,
  attrs: Partial<Record<SignalAttr, string>>,
  liked: boolean,
): SignalMap {
  const step = liked ? LIKE_STEP : DISLIKE_STEP;
  const next: SignalMap = { ...base };

  for (const attr of SIGNAL_ATTRS) {
    const raw = attrs[attr];
    if (!raw || !raw.trim() || isJunk(raw)) continue;
    const key = norm(raw);
    const bucket = { ...(next[attr] ?? {}) };
    bucket[key] = clamp((bucket[key] ?? 0) + step);
    // Drop values that have drifted back to neutral so the map stays small.
    if (bucket[key] === 0) delete bucket[key];
    next[attr] = bucket;
  }

  return next;
}

export interface RankedSignal {
  attr: SignalAttr;
  value: string;
  weight: number;
}

/** Strongest tastes first, positive and negative separately. */
export function rankSignals(map: SignalMap, liked: boolean): RankedSignal[] {
  const out: RankedSignal[] = [];
  for (const attr of SIGNAL_ATTRS) {
    for (const [value, weight] of Object.entries(map[attr] ?? {})) {
      if (liked ? weight > 0 : weight < 0) out.push({ attr, value, weight });
    }
  }
  return out.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

const LABELS: Record<SignalAttr, string> = {
  visualStyle: "visual style",
  hookStyle: "hooks",
  contentFormat: "formats",
  topic: "topics",
  tone: "tone",
  storytelling: "storytelling",
  creatorStyle: "creator style",
  textDensity: "text density",
  ctaStyle: "calls to action",
  videoPacing: "pacing",
  carouselStructure: "carousel structure",
};

export function attrLabel(attr: SignalAttr): string {
  return LABELS[attr];
}

/**
 * A compact brief for the recommender.
 *
 * Only settled taste is stated as a rule; weaker signals are offered as leans,
 * so the feed does not collapse onto one idea after two swipes.
 */
export function signalBrief(map: SignalMap): string {
  const likes = rankSignals(map, true);
  const dislikes = rankSignals(map, false);
  if (!likes.length && !dislikes.length) return "";

  const strongLikes = likes.filter((s) => s.weight >= STRONG);
  const softLikes = likes.filter((s) => s.weight < STRONG);
  const strongDislikes = dislikes.filter((s) => s.weight <= -STRONG);
  const softDislikes = dislikes.filter((s) => s.weight > -STRONG);

  const fmt = (list: RankedSignal[]) =>
    list.slice(0, 8).map((s) => `${attrLabel(s.attr)}: ${s.value}`).join("; ");

  return [
    strongLikes.length ? `Consistently likes — lean into these: ${fmt(strongLikes)}` : "",
    softLikes.length ? `Has liked once or twice: ${fmt(softLikes)}` : "",
    strongDislikes.length ? `Consistently rejects — avoid: ${fmt(strongDislikes)}` : "",
    softDislikes.length ? `Rejected once — use sparingly: ${fmt(softDislikes)}` : "",
    "Keep some variety: do not return only the safest option.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** How many swipes have shaped this brand — used to explain confidence. */
export function signalCount(map: SignalMap): number {
  let n = 0;
  for (const attr of SIGNAL_ATTRS) {
    for (const w of Object.values(map[attr] ?? {})) n += Math.abs(w);
  }
  return n;
}
