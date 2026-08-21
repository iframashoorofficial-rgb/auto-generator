/**
 * Content ideas — the things you swipe through.
 *
 * An idea is not a carousel. The whole point of the deck is variety: a UGC
 * video concept, a meme, a founder POV clip and a carousel should all be able
 * to appear in the same feed, so the shape has to be format-agnostic.
 */

import type { SignalAttr } from "./signals";
import type { MediaRef } from "./media";

export interface ContentFormatDef {
  id: string;
  label: string;
  /** Shown as the small tag on the card. */
  short: string;
  /** How the model should think about this format when writing the concept. */
  brief: string;
  /** Which of our renderable formats this maps to, if any. */
  formatId?: string;
  /** Photo role used for the preview before any image is generated. */
  photo: "establish" | "friction" | "method" | "result" | "repetition";
}

/**
 * The feed's palette of formats. Kept as data so adding one is a single entry
 * rather than a code change anywhere else.
 */
export const CONTENT_FORMATS: ContentFormatDef[] = [
  {
    id: "ugc-video",
    label: "UGC video",
    short: "UGC",
    brief: "A creator-style piece to camera, phone-shot, unpolished and personal.",
    photo: "establish",
  },
  {
    id: "hook-video",
    label: "Hook video",
    short: "Hook",
    brief: "Three seconds to stop the scroll, then one payoff. Nothing else.",
    photo: "friction",
  },
  {
    id: "short-video",
    label: "Short-form video",
    short: "Video",
    brief: "A 15-30 second idea with a clear beginning, turn and end.",
    photo: "method",
  },
  {
    id: "carousel",
    label: "Carousel",
    short: "Carousel",
    brief: "A swipeable sequence that earns each next slide.",
    formatId: "comparison-carousel",
    photo: "repetition",
  },
  {
    id: "proof-carousel",
    label: "Proof carousel",
    short: "Proof",
    brief: "A claim, the evidence behind it, and what to do next.",
    formatId: "proof-drop",
    photo: "result",
  },
  {
    id: "slideshow",
    label: "Slideshow",
    short: "Slideshow",
    brief: "Photo slideshow with text overlays, the low-effort native format.",
    photo: "repetition",
  },
  {
    id: "image-concept",
    label: "Single image",
    short: "Image",
    brief: "One striking still that carries the whole message.",
    photo: "establish",
  },
  {
    id: "meme",
    label: "Meme / reaction",
    short: "Meme",
    brief: "A recognisable format turned on this audience's specific frustration.",
    photo: "friction",
  },
  {
    id: "educational",
    label: "Educational",
    short: "Teach",
    brief: "Teach one genuinely useful thing in under a minute.",
    photo: "method",
  },
  {
    id: "founder-pov",
    label: "Founder POV",
    short: "Founder",
    brief: "The owner's opinion, straight to camera, with a real point of view.",
    photo: "establish",
  },
  {
    id: "product-demo",
    label: "Product demo",
    short: "Demo",
    brief: "Show the thing working. No narration that the visual already gives.",
    photo: "method",
  },
  {
    id: "case-study",
    label: "Story / case study",
    short: "Story",
    brief: "One customer, one before, one after. Named and specific.",
    photo: "result",
  },
];

export function getContentFormat(id: string): ContentFormatDef {
  return CONTENT_FORMATS.find((f) => f.id === id) ?? CONTENT_FORMATS[0];
}

/** The attributes a card teaches when swiped. */
export type IdeaAttrs = Partial<Record<SignalAttr, string>>;

export interface ContentIdea {
  id: string;
  /** One line that would stop the scroll. */
  hook: string;
  /** Two sentences on what the piece actually is. */
  concept: string;
  formatType: string;
  platform: string;
  /** How the visual should look — feeds image generation when asked for. */
  visualDirection: string;
  /** Beat-by-beat shots for video formats. Empty for stills. */
  scenes: string[];
  cta: string;
  topic: string;
  audience: string;
  tone: string;
  /** Strategist-style reasons. Never internal reasoning. */
  why: string[];
  /** What a swipe on this card teaches. */
  attrs: IdeaAttrs;
  /**
   * Visual-search metadata. Used to pick a far more relevant preview than a
   * keyword sweep of the concept text, and to seed an image prompt later.
   */
  visualMeta: VisualMeta;
  /**
   * Whatever asset this idea currently has. Starts as a stock still, becomes
   * a generated image on request, and can be a video the day one exists.
   */
  media?: MediaRef;
  /** Set once the user has swiped it, so a restored deck resumes correctly. */
  decided?: "like" | "pass";
  /** True when the user has hand-edited it — protects it from replenishment. */
  edited?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * What a good preview would show. Kept structured rather than as one prose
 * line so it can drive asset lookup, not just prompting.
 */
export interface VisualMeta {
  subject: string;
  environment: string;
  /** close-up, wide, over-the-shoulder, flat lay, to-camera... */
  shotType: string;
  styleKeywords: string[];
}

export const EMPTY_VISUAL_META: VisualMeta = {
  subject: "",
  environment: "",
  shotType: "",
  styleKeywords: [],
};

/** Fields the editor may change without touching anything generated. */
export const EDITABLE_FIELDS: {
  key: keyof ContentIdea;
  label: string;
  area?: boolean;
}[] = [
  { key: "hook", label: "Hook", area: true },
  { key: "concept", label: "Concept", area: true },
  { key: "topic", label: "Topic" },
  { key: "audience", label: "Audience" },
  { key: "cta", label: "Call to action" },
  { key: "tone", label: "Tone" },
  { key: "visualDirection", label: "Visual direction", area: true },
];

export function ideaId(seed: string, i: number): string {
  const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
  return `${slug || "idea"}-${i}-${Math.floor(Math.random() * 1e6)}`;
}
