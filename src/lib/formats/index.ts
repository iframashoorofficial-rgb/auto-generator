import type { FormatDef } from "./types";
import { comparisonCarousel } from "./comparison-carousel";
import { proofDrop } from "./proof-drop";

/** Every format the app can produce. Add new ones here. */
export const FORMATS: FormatDef[] = [comparisonCarousel, proofDrop];

export function getFormat(id: string): FormatDef {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export type { FormatDef };
export * from "./types";
