/**
 * Image prompt composition.
 *
 * This is the fix for slides that do not look related. Every image is built
 * from three layers, always in the same order and always including the same
 * DNA block:
 *
 *   1. Brand Visual DNA   — constant for the brand, the reason slides match
 *   2. Carousel context   — constant within one carousel
 *   3. Slide scene        — the only part that varies per frame
 *
 * Keeping layer 1 byte-identical across a run is what makes the set cohere;
 * the previous stock-photo approach had no shared layer at all.
 */

import type { BrandProfile, VisualDNA } from "./brand";
import type { FormatDef, FrameDef } from "./formats/types";

/** Sensible starting DNA when the user has not described a look yet. */
export function defaultVisual(sector: string): VisualDNA {
  return {
    aesthetic: "documentary editorial photography, understated and credible",
    palette: ["desaturated neutrals", "one warm amber accent"],
    photography: "35mm full-frame, shallow depth of field, natural perspective",
    lighting: "soft directional daylight, gentle falloff, no harsh flash",
    composition: "generous negative space in the upper third for type",
    mood: "calm, competent, unglamorous",
    realism: "photoreal, never illustrated or 3D-rendered",
    texture: "fine natural grain, matte finish",
    recurring: sector ? `real ${sector} settings and equipment` : "",
    avoid: [
      "text, letters, numbers, watermarks or logos of any kind",
      "stock-photo smiling at camera",
      "over-saturated HDR colour",
      "distorted hands or faces",
    ],
    locked: false,
  };
}

/** The constant block. Identical for every slide of every carousel. */
export function dnaBlock(dna: VisualDNA): string {
  const parts: string[] = [];
  const add = (label: string, v: string | string[]) => {
    const text = Array.isArray(v) ? v.filter(Boolean).join(", ") : v;
    if (text && text.trim()) parts.push(`${label}: ${text.trim()}`);
  };
  add("Aesthetic", dna.aesthetic);
  add("Colour palette", dna.palette);
  add("Photography", dna.photography);
  add("Lighting", dna.lighting);
  add("Composition", dna.composition);
  add("Mood", dna.mood);
  add("Realism", dna.realism);
  add("Texture", dna.texture);
  add("Recurring subjects", dna.recurring);
  return parts.join("\n");
}

export interface SlidePromptInput {
  brand: BrandProfile;
  dna: VisualDNA;
  format: FormatDef;
  frame: FrameDef;
  index: number;
  total: number;
  /** The written copy for this slide, so the image supports rather than repeats it. */
  copy?: string;
}

/**
 * Build the full prompt for one slide.
 *
 * The type is drawn over the photo afterwards by the renderer, so the image
 * itself must contain no words — that ban is repeated because image models
 * are stubborn about inventing signage.
 */
export function buildSlidePrompt(input: SlidePromptInput): string {
  const { brand, dna, format, frame, index, total, copy } = input;
  const b = brand.business;

  const bans = [
    ...dna.avoid,
    "any text, lettering, signage, captions or numerals",
  ].filter(Boolean);

  return [
    "Generate one photograph for a social media carousel slide.",
    "",
    "=== BRAND VISUAL DNA (identical for every slide — do not reinterpret) ===",
    dnaBlock(dna),
    "",
    "=== CAROUSEL CONTEXT ===",
    `Brand: ${b.name || "an independent business"}`,
    b.offering ? `What they do: ${b.offering}` : "",
    b.audience ? `Speaking to: ${b.audience}` : "",
    `Carousel format: ${format.name} — ${format.beats}`,
    `This is slide ${index + 1} of ${total}. All slides must look like one shoot,
     same location world, same camera, same grade.`,
    "",
    "=== THIS SLIDE ===",
    `Beat: ${frame.role}`,
    `It must convey: ${frame.purpose}`,
    `Scene: ${frame.alt}`,
    copy ? `The caption drawn over it will read: "${copy}". Leave it room and do not illustrate it literally.` : "",
    `Leave the ${frame.box.top > 400 ? "upper" : "lower"} portion of the frame visually quiet for type.`,
    "",
    "=== HARD RULES ===",
    ...bans.map((x) => `- No ${x}`),
    `- Vertical ${format.width}x${format.height} aspect ratio.`,
    "- Photographic realism unless the DNA above says otherwise.",
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\n\s+/g, "\n");
}

/**
 * A short, stable style signature. Shown in the UI so a user can see at a
 * glance that two carousels share a look, and used as a cheap change detector.
 */
export function styleSignature(dna: VisualDNA): string {
  const s = [dna.aesthetic, dna.palette.join(","), dna.lighting, dna.realism]
    .join("|")
    .toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 6);
}
