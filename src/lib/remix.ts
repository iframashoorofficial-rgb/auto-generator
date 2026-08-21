/**
 * Remix modes and preference learning.
 *
 * The feedback actions on a finished carousel are the only place the app finds
 * out what a user actually likes. Rather than asking them to fill in a
 * preferences form, we translate each click into a durable signal on the
 * brand record and feed it back into the next generation.
 */

import type { ContentPrefs, VisualDNA } from "./brand";
import type { FormatDef } from "./formats/types";

export type RemixMode =
  | "same-structure-new-topic"
  | "same-visual-style"
  | "new-hook"
  | "new-audience"
  | "another-variation";

export const REMIX_MODES: { id: RemixMode; label: string; hint: string }[] = [
  {
    id: "same-structure-new-topic",
    label: "Same structure, new topic",
    hint: "Keeps the shape that worked, points it at something else",
  },
  {
    id: "same-visual-style",
    label: "Same visual style",
    hint: "Holds the look, rewrites the copy",
  },
  { id: "new-hook", label: "New hook", hint: "Only the opening changes" },
  {
    id: "new-audience",
    label: "New audience",
    hint: "Same offer, aimed at someone else",
  },
  {
    id: "another-variation",
    label: "Another variation",
    hint: "Same brief, a different take",
  },
];

/** The instruction appended to the writing prompt for each mode. */
export function remixInstruction(mode: RemixMode): string {
  switch (mode) {
    case "same-structure-new-topic":
      return "REMIX: keep the narrative structure and rhythm of the previous version exactly, but apply it to a different subject for this brand. Do not reuse its specifics.";
    case "same-visual-style":
      return "REMIX: the visuals stay as they are. Rewrite the copy so it still fits those images, with a different argument.";
    case "new-hook":
      return "REMIX: keep everything after the opening frame close to the previous version. Replace the hook with a genuinely different entry point.";
    case "new-audience":
      return "REMIX: same offer and same proof, rewritten for a different audience. Change the assumed knowledge, the pains named, and the vocabulary.";
    case "another-variation":
      return "REMIX: same brief, a different take. Avoid repeating the previous version's phrasing, structure or opening move.";
  }
}

/**
 * Turn a thumbs-up / thumbs-down on a carousel into preference deltas.
 *
 * Signals stay short and human-readable because they are pasted straight into
 * the next prompt — an opaque score would teach the model nothing.
 */
export function learnFrom(
  prefs: ContentPrefs,
  opts: {
    liked: boolean;
    format: FormatDef;
    slots: Record<string, string>;
    visual: VisualDNA;
  },
): ContentPrefs {
  const { liked, format, slots, visual } = opts;

  const hook = firstNonEmpty(slots);
  const density = describeDensity(slots);
  const signal = [
    `${format.name} (${format.beats})`,
    hook ? `hook like "${truncate(hook, 60)}"` : "",
    density,
    visual.aesthetic ? `visuals: ${truncate(visual.aesthetic, 48)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const next: ContentPrefs = { ...prefs };

  if (liked) {
    next.liked = capped([...prefs.liked, signal]);
    // A liked carousel also sets the defaults, so the next one starts here.
    next.structure = format.beats;
    next.slideCount = String(format.frames.length);
    next.textDensity = density;
    if (hook) next.hookStyle = truncate(hook, 70);
    if (visual.aesthetic) next.visualStyle = visual.aesthetic;
  } else {
    next.disliked = capped([...prefs.disliked, signal]);
  }

  return next;
}

/** Keep the tail — recent taste beats old taste, and prompts have budgets. */
function capped(list: string[], max = 8): string[] {
  const unique = Array.from(new Set(list.filter(Boolean)));
  return unique.slice(-max);
}

function firstNonEmpty(slots: Record<string, string>): string {
  for (const v of Object.values(slots)) if (v && v.trim()) return v.trim();
  return "";
}

function describeDensity(slots: Record<string, string>): string {
  const values = Object.values(slots).filter(Boolean);
  if (!values.length) return "";
  const avg = values.reduce((n, v) => n + v.length, 0) / values.length;
  if (avg < 28) return "very short lines";
  if (avg < 55) return "short lines";
  if (avg < 90) return "medium lines";
  return "long lines";
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
