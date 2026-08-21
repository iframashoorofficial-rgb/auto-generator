/**
 * The recommendation pool.
 *
 * Calling the model for a fresh batch on every refresh was wasteful and slow.
 * Instead we hold a pool of ideas, rank it locally against the brand's learned
 * weights, serve the top cards from it, rerank after every swipe, and only pay
 * for generation when the pool actually runs low.
 *
 * Ranking is deliberately plain arithmetic — no model call — so a swipe
 * reorders the deck instantly and for free.
 */

import type { ContentIdea } from "./ideas";
import { getContentFormat } from "./ideas";
import { matchPack, type Pack, type PhotoRole } from "./packs";
import { imageRef, type MediaRef } from "./media";
import { SIGNAL_ATTRS, type SignalMap } from "./signals";

/** Fetch more once fewer than this many undecided cards remain. */
export const LOW_WATER = 3;
/** Stop hoarding: no point holding more than the user will see in a sitting. */
export const POOL_CAP = 24;

/**
 * Score one idea against learned taste.
 *
 * Each attribute the idea declares looks itself up in the weight map. Matching
 * a liked value adds its weight, matching a disliked value subtracts it. An
 * idea that declares nothing scores zero and sits mid-deck, which is the right
 * place for something we know nothing about.
 */
export function scoreIdea(idea: ContentIdea, signals: SignalMap): number {
  let score = 0;
  for (const attr of SIGNAL_ATTRS) {
    const value = idea.attrs?.[attr];
    if (!value) continue;
    const weight = signals[attr]?.[value.trim().toLowerCase()];
    if (typeof weight === "number") score += weight;
  }
  // A hand-edited idea is one the user has invested in — float it up.
  if (idea.edited) score += 1.5;
  return score;
}

/**
 * Undecided ideas, best first.
 *
 * Ties keep insertion order so a reorder never looks random, and freshly
 * fetched ideas do not leapfrog older ones for no reason.
 */
export function rankPool(pool: ContentIdea[], signals: SignalMap): ContentIdea[] {
  return pool
    .map((idea, i) => ({ idea, i, score: scoreIdea(idea, signals) }))
    .filter((x) => !x.idea.decided)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.idea);
}

export function undecidedCount(pool: ContentIdea[]): number {
  return pool.filter((i) => !i.decided).length;
}

/** Drop the oldest decided cards once the pool is oversized. */
export function trimPool(pool: ContentIdea[]): ContentIdea[] {
  if (pool.length <= POOL_CAP) return pool;
  const undecided = pool.filter((i) => !i.decided);
  const decided = pool.filter((i) => i.decided).sort((a, b) => b.updatedAt - a.updatedAt);
  return [...undecided, ...decided].slice(0, POOL_CAP);
}

/** Do not show the same hook twice, even across batches. */
export function dedupe(pool: ContentIdea[], incoming: ContentIdea[]): ContentIdea[] {
  const seen = new Set(pool.map((i) => i.hook.trim().toLowerCase()));
  return incoming.filter((i) => {
    const key = i.hook.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ---- Preview selection ------------------------------------------------- */

/**
 * Which photo role best fits the shot the idea describes.
 *
 * The library is small, so this is about picking the least wrong of five
 * roles rather than finding a perfect match — but using the structured
 * subject/environment/shot metadata beats sweeping the whole concept string,
 * which previously matched on words like "founders" and "evenings".
 */
const ROLE_HINTS: Record<PhotoRole, string[]> = {
  establish: ["portrait", "to-camera", "person", "founder", "selfie", "desk", "office", "wide", "establishing"],
  friction: ["problem", "mess", "frustrat", "broken", "pile", "clutter", "before", "struggle", "queue", "waiting"],
  method: ["process", "hands", "working", "how", "step", "close-up", "closeup", "detail", "screen", "demo", "tool"],
  result: ["after", "finished", "clean", "success", "result", "delivered", "outcome", "proof", "happy"],
  repetition: ["sequence", "series", "multiple", "grid", "flat lay", "collection", "stack", "row"],
};

export interface PreviewInput {
  subject?: string;
  environment?: string;
  shotType?: string;
  styleKeywords?: string[];
  /** Falls back to the format's declared role when metadata says nothing. */
  formatType: string;
  /** Used to choose the pack. */
  topic?: string;
  sector?: string;
}

/** Choose the stock still that best matches the described shot. */
export function pickPreview(input: PreviewInput, packOverride?: Pack): MediaRef {
  const fmt = getContentFormat(input.formatType);
  const meta = [input.subject, input.environment, input.shotType, (input.styleKeywords ?? []).join(" ")]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Pack choice leans on the concrete environment/subject, not the hook prose.
  const pack =
    packOverride ??
    matchPack([input.environment, input.subject, input.sector, input.topic].filter(Boolean).join(" "));

  let role: PhotoRole = fmt.photo;
  if (meta) {
    let best = 0;
    for (const [candidate, hints] of Object.entries(ROLE_HINTS) as [PhotoRole, string[]][]) {
      const score = hints.reduce((n, h) => (meta.includes(h) ? n + 1 : n), 0);
      if (score > best) {
        best = score;
        role = candidate;
      }
    }
  }

  const url = pack.photos[role] ?? pack.photos.establish;
  return imageRef(url, "stock", input.subject ? `${input.subject}` : "");
}
