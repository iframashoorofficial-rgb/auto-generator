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

import type { ContentAsset } from "./assets";
import { SIGNAL_ATTRS, type SignalMap } from "./signals";

/**
 * Keep roughly this many undecided cards to hand.
 *
 * A batch is capped at four because composing finished assets is slow and the
 * route has a 60s ceiling, so the deck fills over two or three background
 * top-ups while the user is already swiping the first few.
 *
 * Measured 22 Aug 2026, do not raise this casually: a single /api/recommend
 * call took 3s, 20s and 41s on three consecutive top-ups. Against the route's
 * 60s ceiling that is little headroom, and every extra card this threshold
 * asks for is another paid call rolling the same dice. Briefly set to 15,
 * which meant four such calls on every visit; reverted.
 */
export const LOW_WATER = 9;
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
export function scoreIdea(idea: ContentAsset, signals: SignalMap): number {
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
export function rankPool(pool: ContentAsset[], signals: SignalMap): ContentAsset[] {
  return pool
    .map((idea, i) => ({ idea, i, score: scoreIdea(idea, signals) }))
    .filter((x) => !x.idea.decided)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.idea);
}

export function undecidedCount(pool: ContentAsset[]): number {
  return pool.filter((i) => !i.decided).length;
}

/** Drop the oldest decided cards once the pool is oversized. */
export function trimPool(pool: ContentAsset[]): ContentAsset[] {
  if (pool.length <= POOL_CAP) return pool;
  const undecided = pool.filter((i) => !i.decided);
  const decided = pool.filter((i) => i.decided).sort((a, b) => b.updatedAt - a.updatedAt);
  return [...undecided, ...decided].slice(0, POOL_CAP);
}

/** Do not show the same hook twice, even across batches. */
export function dedupe(pool: ContentAsset[], incoming: ContentAsset[]): ContentAsset[] {
  const seen = new Set(pool.map((i) => i.caption.trim().toLowerCase()));
  return incoming.filter((i) => {
    const key = i.caption.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
