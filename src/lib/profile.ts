/**
 * The business profile.
 *
 * Built once by the intake agent and reused by every format. This is the
 * reason intake is not shaped like any single format: the agent's job is to
 * understand the business, and formats draw on that understanding afterwards.
 */

export interface BusinessProfile {
  /** Trading name, as it should appear on screen. */
  name: string;
  /** What they actually sell or do, in plain words. */
  offering: string;
  /** Who buys it. Specific beats broad. */
  audience: string;
  /** The pain the customer feels before buying. */
  problem: string;
  /** What a customer does today instead — a rival product, or the manual way. */
  alternative: string;
  /** Why they win against that alternative. */
  edge: string;
  /** Concrete things that are true and checkable. Never invented. */
  proof: string[];
  /** How the brand talks: blunt, warm, technical, playful. */
  voice: string;
  /** What the customer should do next. */
  callToAction: string;
  /** Anything that must not be claimed — legal, factual, or brand limits. */
  avoid: string[];
  /** Industry hint used to choose photography. */
  sector: string;
  /**
   * Who customers usually go to instead, by name. Optional: without it the
   * competitor-contrast template falls back to `alternative`, the manual way.
   */
  competitor?: string;
}

export const EMPTY_PROFILE: BusinessProfile = {
  name: "",
  offering: "",
  audience: "",
  problem: "",
  alternative: "",
  edge: "",
  proof: [],
  voice: "",
  callToAction: "",
  avoid: [],
  sector: "",
  competitor: "",
};

/** Fields the agent must fill before we consider the profile usable. */
const REQUIRED: (keyof BusinessProfile)[] = [
  "name",
  "offering",
  "audience",
  "problem",
  "alternative",
  "edge",
];

export function missingFields(p: BusinessProfile): string[] {
  return REQUIRED.filter((k) => {
    const v = p[k];
    return typeof v === "string" ? v.trim() === "" : !v || v.length === 0;
  });
}

export function completeness(p: BusinessProfile): number {
  const filled = REQUIRED.length - missingFields(p).length;
  return Math.round((filled / REQUIRED.length) * 100);
}

/** Merge a partial update from the agent without wiping known values. */
export function mergeProfile(
  base: BusinessProfile,
  patch: Partial<BusinessProfile> | null | undefined,
): BusinessProfile {
  if (!patch) return base;
  const next: BusinessProfile = { ...base };
  (Object.keys(patch) as (keyof BusinessProfile)[]).forEach((k) => {
    const v = patch[k];
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) {
      if (v.length) (next[k] as string[]) = v as string[];
    } else if (typeof v === "string" && v.trim() !== "") {
      (next[k] as string) = v.trim();
    }
  });
  return next;
}

export function profileSummary(p: BusinessProfile): string {
  const lines: string[] = [];
  const add = (label: string, value: string | string[]) => {
    const text = Array.isArray(value) ? value.join("; ") : value;
    if (text && text.trim()) lines.push(`${label}: ${text.trim()}`);
  };
  add("Business", p.name);
  add("Sells", p.offering);
  add("Audience", p.audience);
  add("Problem it solves", p.problem);
  add("What customers do instead", p.alternative);
  add("Why it wins", p.edge);
  add("Verifiable proof", p.proof);
  add("Voice", p.voice);
  add("Call to action", p.callToAction);
  add("Never claim", p.avoid);
  add("Sector", p.sector);
  return lines.join("\n");
}
