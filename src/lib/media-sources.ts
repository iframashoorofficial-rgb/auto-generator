/**
 * Media sources.
 *
 * One registry so composition never cares where a clip or still came from.
 * Today only the bundled pack is wired up; stock video, user uploads,
 * reaction media and generated visuals each become one more entry rather than
 * a change to the card, the deck or the composer.
 *
 * LICENSING: a source must declare its reuse terms. Nothing is added to an
 * asset unless its source says it may be reused — that is why `licence` is
 * required rather than optional.
 */

import { PACKS, matchPack, type PhotoRole } from "./packs";
import { imageRef, type MediaRef } from "./media";
import type { VisualMeta } from "./ideas";

export type Licence =
  /** Shipped with the app; cleared for use in generated output. */
  | "bundled"
  /** Provider allows commercial reuse (e.g. Pexels/Unsplash licence). */
  | "stock-reusable"
  /** The user supplied it, so they hold the rights. */
  | "user-owned"
  /** Produced by the image model for this brand. */
  | "generated";

export interface MediaQuery extends Partial<VisualMeta> {
  /** "image" or "video" — a source may support only one. */
  want: "image" | "video";
  /** Free-text context to help matching, e.g. the brand sector. */
  context?: string;
}

export interface MediaSource {
  id: string;
  label: string;
  licence: Licence;
  kinds: ("image" | "video")[];
  /** True when the source is usable right now. */
  available: boolean;
  /** Why it is unavailable, shown in the UI rather than failing silently. */
  note?: string;
  /** Returns a reference, or null when the source has nothing suitable. */
  find(query: MediaQuery): MediaRef | null;
}

/** Maps a described shot onto one of the five pack roles. */
const ROLE_HINTS: Record<PhotoRole, string[]> = {
  establish: ["portrait", "to-camera", "founder", "selfie", "desk", "office", "wide", "establishing", "person"],
  friction: ["problem", "mess", "frustrat", "broken", "pile", "clutter", "before", "struggle", "queue", "waiting", "stress"],
  method: ["process", "hands", "working", "step", "close-up", "closeup", "detail", "screen", "demo", "tool"],
  result: ["after", "finished", "clean", "success", "result", "delivered", "outcome", "proof", "happy"],
  repetition: ["sequence", "series", "multiple", "grid", "flat lay", "collection", "stack", "row"],
};

function roleFor(text: string, fallback: PhotoRole): PhotoRole {
  if (!text) return fallback;
  let best = 0;
  let role = fallback;
  for (const [candidate, hints] of Object.entries(ROLE_HINTS) as [PhotoRole, string[]][]) {
    const score = hints.reduce((n, h) => (text.includes(h) ? n + 1 : n), 0);
    if (score > best) {
      best = score;
      role = candidate;
    }
  }
  return role;
}

/** The 17 stills bundled with the app. */
const bundledStills: MediaSource = {
  id: "bundled-stills",
  label: "Bundled photography",
  licence: "bundled",
  kinds: ["image"],
  available: true,
  find(query) {
    if (query.want !== "image") return null;
    const text = [query.subject, query.environment, query.shotType, (query.styleKeywords ?? []).join(" ")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const pack = matchPack(
      [query.environment, query.subject, query.context].filter(Boolean).join(" "),
    );
    const role = roleFor(text, "establish");
    const url = pack.photos[role] ?? pack.photos.establish;
    return imageRef(url, "stock", query.subject ?? "");
  },
};

/**
 * Placeholders for sources that are not connected yet.
 *
 * They exist so the gap is visible in code and in the UI rather than being
 * an unstated assumption that everything is a still.
 */
const stockVideo: MediaSource = {
  id: "stock-video",
  label: "Stock video",
  licence: "stock-reusable",
  kinds: ["video"],
  available: false,
  note: "No stock-video provider is connected, so reels compose over stills.",
  find: () => null,
};

const reactionMedia: MediaSource = {
  id: "reaction",
  label: "Reaction media",
  licence: "stock-reusable",
  kinds: ["image", "video"],
  available: false,
  note: "No cleared reaction library is connected; memes use brand media instead.",
  find: () => null,
};

const userUploads: MediaSource = {
  id: "user-uploads",
  label: "Your uploads",
  licence: "user-owned",
  kinds: ["image", "video"],
  available: false,
  note: "Upload media in the studio to use it here.",
  find: () => null,
};

export const MEDIA_SOURCES: MediaSource[] = [
  userUploads,
  stockVideo,
  reactionMedia,
  bundledStills,
];

/**
 * Ask every available source in priority order.
 *
 * Video is requested first for a reel; when nothing can supply it the still
 * fallback keeps the asset renderable rather than leaving a hole.
 */
export function findMedia(query: MediaQuery): MediaRef | null {
  for (const source of MEDIA_SOURCES) {
    if (!source.available || !source.kinds.includes(query.want)) continue;
    const hit = source.find(query);
    if (hit) return hit;
  }
  if (query.want === "video") return findMedia({ ...query, want: "image" });
  return null;
}

export function unavailableSources(): MediaSource[] {
  return MEDIA_SOURCES.filter((s) => !s.available);
}
