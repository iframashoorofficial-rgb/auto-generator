/**
 * The deterministic screen.
 *
 * Runs between generating concepts and writing them up, and costs nothing —
 * no model call, no latency. Its job is to kill the generic ones before the
 * expensive stage is spent on them.
 *
 * This is the piece the old pipeline was missing entirely. `publishProblems`
 * only ever checked structure, so a card with a caption and the right slide
 * count passed however boring it was, and `bannedPhrasesIn` was written but
 * never called from anywhere.
 */

import { bannedPhrasesIn } from "./comedy";

/**
 * A concrete anchor: a number, a price, a time, a percentage, a named day or
 * month, or a mid-sentence proper noun.
 *
 * The single most reliable generic-detector there is. "admin is annoying" has
 * none and is filler; "a spreadsheet named final_FINAL_v3" has one and is a
 * joke. It is also exactly what COMEDY_RULES already asks for, so enforcing it
 * here just makes an existing rule real.
 */
const ANCHOR_PATTERNS: RegExp[] = [
  /\b\d{1,2}:\d{2}\s?(?:am|pm)?\b/i,
  /[$£€]\s?\d/,
  /\b\d+\s?%/,
  /\b\d+\b/,
  // "2pm", "5k", "3x", "40hrs" — a digit glued to letters has no trailing
  // word boundary, so the bare-number pattern above misses it entirely.
  /\b\d+[a-z]{1,4}\b/i,
  /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /(?<!^)(?<![.!?]\s)\b[A-Z][a-z]{2,}\b/,
];

export function hasAnchor(text: string): boolean {
  return ANCHOR_PATTERNS.some((p) => p.test(text));
}

/** Tails that explain the joke instead of letting it land. */
const EXPLAINER_TAILS = [
  /\band that's when\b/i,
  /\bwhich is why\b/i,
  /\bso yeah\b/i,
  /\bif you know you know\b/i,
  /\bam i right\b/i,
  /\blol\b/i,
  /\bhaha\b/i,
];

export interface Concept {
  /** Which library asset or copy format this is written for. */
  assetId: string;
  /** Slot or beat name -> the words. */
  text: Record<string, string>;
  /** One line on why it is funny. Screened, never rendered. */
  why?: string;
}

export interface Screened {
  kept: Concept[];
  dropped: { assetId: string; reason: string; text: string }[];
}

function flatten(c: Concept): string {
  return Object.values(c.text ?? {})
    .filter((v) => typeof v === "string")
    .join(" ")
    .trim();
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Screen a batch of concepts.
 *
 * Anchors are checked across the WHOLE concept rather than per slot: a
 * four-word slot cannot carry a number on its own and should not have to.
 *
 * `limits` gives the per-slot word budget for the asset a concept targets, so a
 * concept that cannot physically fit its template is dropped here rather than
 * being rendered overflowing.
 */
export function screenConcepts(
  concepts: Concept[],
  opts: {
    /** Captions already shown, so a top-up cannot repeat one. */
    exclude?: string[];
    /** assetId -> slot name -> max words. */
    limits?: Record<string, Record<string, number>>;
  } = {},
): Screened {
  const kept: Concept[] = [];
  const dropped: Screened["dropped"] = [];
  const seen = new Set((opts.exclude ?? []).map(normalise));

  for (const c of concepts) {
    const whole = flatten(c);
    const drop = (reason: string) => dropped.push({ assetId: c.assetId, reason, text: whole.slice(0, 120) });

    if (!whole) {
      drop("empty");
      continue;
    }

    const banned = bannedPhrasesIn(whole);
    if (banned.length) {
      drop(`banned phrase: ${banned.join(", ")}`);
      continue;
    }

    if (!hasAnchor(whole)) {
      drop("no concrete anchor — nothing specific enough to be funny");
      continue;
    }

    if (EXPLAINER_TAILS.some((p) => p.test(whole))) {
      drop("explains its own joke");
      continue;
    }

    const limits = opts.limits?.[c.assetId];
    if (limits) {
      const over = Object.entries(c.text).find(([slot, value]) => {
        const max = limits[slot];
        return max && String(value).trim().split(/\s+/).filter(Boolean).length > max;
      });
      if (over) {
        drop(`slot "${over[0]}" is too long for this template`);
        continue;
      }
    }

    const key = normalise(whole);
    if (seen.has(key)) {
      drop("duplicate");
      continue;
    }

    seen.add(key);
    kept.push(c);
  }

  return { kept, dropped };
}
