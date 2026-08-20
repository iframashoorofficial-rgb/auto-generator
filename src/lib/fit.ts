/**
 * Display type must never wrap — a wrapped headline destroys the hierarchy
 * these layouts depend on. Instead the line shrinks until it fits.
 *
 * Shared deliberately: the on-screen preview and the exported PNG must agree,
 * and duplicating this rule is exactly how they would silently diverge.
 */
export function fitSize(text: string, base: number, avail: number): number {
  if (!text) return base;
  const estimated = base * 0.54 * text.length;
  if (estimated <= avail) return base;
  return Math.max(30, Math.floor(base * (avail / estimated)));
}

/** The typeface stack used on every frame, in both preview and export. */
export const FRAME_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

/** Matches `line-height` on `.frameLine` in globals.css. */
export const FRAME_LINE_HEIGHT = 1.02;

/** Matches `letter-spacing` on `.frameLine` in globals.css. */
export const FRAME_LETTER_SPACING = -0.024;
