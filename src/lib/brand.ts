/**
 * Brand memory.
 *
 * `BusinessProfile` (see profile.ts) stays exactly as it was — every format and
 * the copywriter still read it. This file wraps it in the longer-lived record
 * the assistant maintains across sessions: how the brand looks, what it wants
 * from content, and what the user has taught us by reacting to output.
 *
 * Everything here is plain data so it can round-trip through localStorage.
 */

import {
  EMPTY_PROFILE,
  mergeProfile,
  type BusinessProfile,
} from "./profile";

/**
 * The look. Composed into every image prompt so slides in one carousel — and
 * carousels months apart — read as the same brand.
 */
export interface VisualDNA {
  /** Overall aesthetic, e.g. "documentary editorial, unfussy". */
  aesthetic: string;
  /** Colour direction as plain words plus optional hex chips. */
  palette: string[];
  /** Photographic treatment, e.g. "35mm, shallow depth of field". */
  photography: string;
  lighting: string;
  composition: string;
  mood: string;
  /** How literal the image should be: photoreal, illustrated, mixed. */
  realism: string;
  texture: string;
  /** People or products that should recur, for continuity. */
  recurring: string;
  /** Hard visual bans — props, clichés, colours. */
  avoid: string[];
  /** Set once the user says "use this visual style going forward". */
  locked: boolean;
}

export const EMPTY_VISUAL: VisualDNA = {
  aesthetic: "",
  palette: [],
  photography: "",
  lighting: "",
  composition: "",
  mood: "",
  realism: "",
  texture: "",
  recurring: "",
  avoid: [],
  locked: false,
};

/**
 * What the user keeps choosing. Updated by the feedback actions on a finished
 * carousel rather than by asking — preferences are revealed, not declared.
 */
export interface ContentPrefs {
  hookStyle: string;
  structure: string;
  slideCount: string;
  textDensity: string;
  ctaStyle: string;
  storytelling: string;
  visualStyle: string;
  /** Free-text signals harvested from "more like this" / "less like this". */
  liked: string[];
  disliked: string[];
}

export const EMPTY_PREFS: ContentPrefs = {
  hookStyle: "",
  structure: "",
  slideCount: "",
  textDensity: "",
  ctaStyle: "",
  storytelling: "",
  visualStyle: "",
  liked: [],
  disliked: [],
};

export interface BrandProfile {
  /** The existing profile, untouched. */
  business: BusinessProfile;
  website: string;
  /** One line on where they sit in their market. */
  positioning: string;
  /** What they want content to achieve. */
  contentGoals: string[];
  /** Where it gets posted. */
  platforms: string[];
  visual: VisualDNA;
  prefs: ContentPrefs;
  /** True once the website has been read. */
  researched: boolean;
  /** True once the user has confirmed we found the right brand. */
  confirmed: boolean;
  /** True once onboarding hit 100% and the workspace unlocked. */
  onboarded: boolean;
  updatedAt: number;
}

export const EMPTY_BRAND: BrandProfile = {
  business: EMPTY_PROFILE,
  website: "",
  positioning: "",
  contentGoals: [],
  platforms: [],
  visual: EMPTY_VISUAL,
  prefs: EMPTY_PREFS,
  researched: false,
  confirmed: false,
  onboarded: false,
  updatedAt: 0,
};

/**
 * What onboarding must collect before the workspace unlocks.
 *
 * Deliberately broader than profile.ts's REQUIRED, which only covers what the
 * copywriter needs. Onboarding is also gathering look and intent.
 */
export interface BrandField {
  /** Stable id, also used as the progress-bar segment key. */
  key: string;
  /** Shown in the progress tooltip. */
  label: string;
  /** Reads the brand and says whether we have it. */
  filled: (b: BrandProfile) => boolean;
}

const has = (s: string) => s.trim().length > 0;
const hasAny = (a: string[]) => a.filter((x) => x && x.trim()).length > 0;

export const BRAND_FIELDS: BrandField[] = [
  { key: "name", label: "Brand name", filled: (b) => has(b.business.name) },
  { key: "offering", label: "What you do", filled: (b) => has(b.business.offering) },
  { key: "audience", label: "Audience", filled: (b) => has(b.business.audience) },
  { key: "problem", label: "Problem you solve", filled: (b) => has(b.business.problem) },
  { key: "edge", label: "Value proposition", filled: (b) => has(b.business.edge) },
  { key: "voice", label: "Tone of voice", filled: (b) => has(b.business.voice) },
  { key: "positioning", label: "Positioning", filled: (b) => has(b.positioning) },
  { key: "goals", label: "Content goals", filled: (b) => hasAny(b.contentGoals) },
  { key: "platforms", label: "Platforms", filled: (b) => hasAny(b.platforms) },
  {
    key: "visual",
    label: "Visual style",
    filled: (b) => has(b.visual.aesthetic) || hasAny(b.visual.palette),
  },
  { key: "cta", label: "Call to action", filled: (b) => has(b.business.callToAction) },
  { key: "confirmed", label: "Brand confirmed", filled: (b) => b.confirmed },
];

export function brandProgress(b: BrandProfile): number {
  const done = BRAND_FIELDS.filter((f) => f.filled(b)).length;
  return Math.round((done / BRAND_FIELDS.length) * 100);
}

export function missingBrandFields(b: BrandProfile): BrandField[] {
  return BRAND_FIELDS.filter((f) => !f.filled(b));
}

/**
 * An update from the agent or the UI. The nested records are themselves
 * partial — a turn that learns one fact should not have to send the rest.
 */
export interface BrandPatch
  extends Partial<Omit<BrandProfile, "business" | "visual" | "prefs">> {
  business?: Partial<BusinessProfile>;
  visual?: Partial<VisualDNA>;
  prefs?: Partial<ContentPrefs>;
}

/** Keys that belong inside `business` but which models like to emit flat. */
const BUSINESS_KEYS: (keyof BusinessProfile)[] = [
  "name", "offering", "audience", "problem", "alternative", "edge",
  "proof", "voice", "callToAction", "avoid", "sector",
];

/**
 * Accept the shape the model actually produces.
 *
 * Told to return `{business: {...}}` a model will still sometimes hoist those
 * fields to the top level. Rejecting that silently loses the brand name on the
 * very first turn, so fold stray keys back where they belong instead.
 */
export function normalizePatch(raw: unknown): BrandPatch {
  if (!raw || typeof raw !== "object") return {};
  const patch = { ...(raw as Record<string, unknown>) };
  const business = { ...((patch.business as object) ?? {}) } as Record<string, unknown>;

  for (const k of BUSINESS_KEYS) {
    if (k in patch && !(k in business)) {
      business[k] = patch[k];
      delete patch[k];
    }
  }

  if (Object.keys(business).length) patch.business = business;
  return patch as BrandPatch;
}

/** Deep-ish merge of a partial update. Never clears a known value with blank. */
export function mergeBrand(
  base: BrandProfile,
  patch: BrandPatch | null | undefined,
): BrandProfile {
  if (!patch) return base;

  const next: BrandProfile = {
    ...base,
    business: patch.business
      ? mergeProfile(base.business, patch.business)
      : base.business,
    visual: patch.visual ? mergeVisual(base.visual, patch.visual) : base.visual,
    prefs: patch.prefs ? { ...base.prefs, ...stripBlank(patch.prefs) } : base.prefs,
    updatedAt: Date.now(),
  };

  if (patch.website?.trim()) next.website = patch.website.trim();
  if (patch.positioning?.trim()) next.positioning = patch.positioning.trim();
  if (patch.contentGoals?.length) next.contentGoals = patch.contentGoals;
  if (patch.platforms?.length) next.platforms = patch.platforms;
  if (typeof patch.researched === "boolean") next.researched = patch.researched;
  if (typeof patch.confirmed === "boolean") next.confirmed = patch.confirmed;
  if (typeof patch.onboarded === "boolean") next.onboarded = patch.onboarded;

  return next;
}

export function mergeVisual(
  base: VisualDNA,
  patch: Partial<VisualDNA> | null | undefined,
): VisualDNA {
  if (!patch) return base;
  const next = { ...base };
  (Object.keys(patch) as (keyof VisualDNA)[]).forEach((k) => {
    const v = patch[k];
    if (v === undefined || v === null) return;
    if (typeof v === "boolean") {
      (next[k] as boolean) = v;
    } else if (Array.isArray(v)) {
      if (v.length) (next[k] as string[]) = v;
    } else if (typeof v === "string" && v.trim() !== "") {
      (next[k] as string) = v.trim();
    }
  });
  return next;
}

/** Drop empty strings/arrays so a patch never blanks a known preference. */
function stripBlank(patch: Partial<ContentPrefs>): Partial<ContentPrefs> {
  const out: Record<string, unknown> = {};
  Object.entries(patch).forEach(([k, v]) => {
    if (typeof v === "string" && !v.trim()) return;
    if (Array.isArray(v) && !v.length) return;
    if (v === undefined || v === null) return;
    out[k] = v;
  });
  return out as Partial<ContentPrefs>;
}

/** Plain-text brand brief handed to the copywriter and the image prompter. */
export function brandSummary(b: BrandProfile): string {
  const lines: string[] = [];
  const add = (label: string, v: string | string[]) => {
    const text = Array.isArray(v) ? v.join("; ") : v;
    if (text && text.trim()) lines.push(`${label}: ${text.trim()}`);
  };
  add("Website", b.website);
  add("Positioning", b.positioning);
  add("Content goals", b.contentGoals);
  add("Platforms", b.platforms);
  if (b.prefs.hookStyle || b.prefs.storytelling || b.prefs.ctaStyle) {
    add("Preferred hooks", b.prefs.hookStyle);
    add("Preferred storytelling", b.prefs.storytelling);
    add("Preferred CTA style", b.prefs.ctaStyle);
    add("Preferred text density", b.prefs.textDensity);
  }
  add("They liked", b.prefs.liked.slice(-6));
  add("They disliked", b.prefs.disliked.slice(-6));
  return lines.join("\n");
}
