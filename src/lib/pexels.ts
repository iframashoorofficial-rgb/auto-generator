/**
 * Pexels — real footage and stills.
 *
 * Chosen because the Pexels licence permits commercial use without
 * attribution, which is the bar this product needs: our users post what comes
 * out of here under their own brand. GIPHY and most meme libraries fail that
 * bar — their content is licensed for personal, non-commercial use only, and
 * is largely third-party copyrighted material they cannot sublicense.
 *
 * Degrades cleanly: with no key configured every lookup returns null and the
 * bundled stills take over, so the app works exactly as before.
 */

import { imageRef, videoRef, type MediaRef } from "./media";

const VIDEO_ENDPOINT = "https://api.pexels.com/videos/search";
const PHOTO_ENDPOINT = "https://api.pexels.com/v1/search";

export function pexelsEnabled(): boolean {
  return Boolean(process.env.PEXELS_API_KEY);
}

interface PexelsVideoFile {
  link: string;
  width?: number;
  height?: number;
  file_type?: string;
}

interface PexelsVideo {
  id: number;
  image?: string;
  video_files?: PexelsVideoFile[];
}

interface PexelsPhoto {
  id: number;
  alt?: string;
  src?: { large?: string; portrait?: string; medium?: string };
}

/**
 * Turn a described shot into a search query.
 *
 * Subject and environment carry the meaning; shot type and style words are
 * noise to a stock search engine and actively hurt recall, so they are left
 * out. Stock libraries match nouns, not direction.
 */
export function toQuery(meta: {
  subject?: string;
  environment?: string;
  context?: string;
}): string {
  const words = [meta.subject, meta.environment]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    // Strip possessives and filler that never appear in stock captions.
    .replace(/['’]s\b/g, "")
    .replace(/\b(a|an|the|of|with|and|at|in|on|to|his|her|their|its)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Long queries return nothing from Pexels; the first few nouns do best.
  return words.slice(0, 5).join(" ") || meta.context || "person walking city";
}

async function call<T>(url: string, key: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** A vertical clip suited to a 9:16 card, or null. */
export async function findVideo(query: string): Promise<MediaRef | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query) return null;

  const url = `${VIDEO_ENDPOINT}?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5&size=medium`;
  const data = await call<{ videos?: PexelsVideo[] }>(url, key);
  const video = data?.videos?.[0];
  if (!video) return null;

  // Prefer a portrait mp4 that is big enough to fill a card but not a 4K file
  // the browser has to chew through.
  const files = (video.video_files ?? []).filter((f) => f.file_type === "video/mp4");
  const portrait = files
    .filter((f) => (f.height ?? 0) >= (f.width ?? 0))
    .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
  const pick = portrait.find((f) => (f.height ?? 0) >= 900) ?? portrait[0] ?? files[0];
  if (!pick?.link) return null;

  return videoRef(pick.link, video.image, "external");
}

export async function findPhoto(query: string): Promise<MediaRef | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query) return null;

  const url = `${PHOTO_ENDPOINT}?query=${encodeURIComponent(query)}&orientation=portrait&per_page=5`;
  const data = await call<{ photos?: PexelsPhoto[] }>(url, key);
  const photo = data?.photos?.[0];
  const src = photo?.src?.portrait ?? photo?.src?.large ?? photo?.src?.medium;
  if (!src) return null;

  return imageRef(src, "external", photo?.alt ?? "");
}

/**
 * Resolve many shots at once.
 *
 * Deduplicated and capped: a batch of four assets can hold twenty slides, and
 * twenty sequential lookups would push the route past its timeout. Identical
 * queries are fetched once and shared.
 */
export async function findMany(
  requests: { key: string; query: string; want: "image" | "video" }[],
  cap = 14,
): Promise<Map<string, MediaRef>> {
  const out = new Map<string, MediaRef>();
  if (!pexelsEnabled()) return out;

  const unique = new Map<string, { query: string; want: "image" | "video" }>();
  for (const r of requests) {
    const dedupeKey = `${r.want}:${r.query}`;
    if (!unique.has(dedupeKey) && unique.size < cap) {
      unique.set(dedupeKey, { query: r.query, want: r.want });
    }
  }

  const results = await Promise.all(
    [...unique.entries()].map(async ([dedupeKey, r]) => {
      const ref = r.want === "video" ? await findVideo(r.query) : await findPhoto(r.query);
      return [dedupeKey, ref] as const;
    }),
  );

  const byDedupe = new Map(results.filter(([, ref]) => ref) as [string, MediaRef][]);
  for (const r of requests) {
    const ref = byDedupe.get(`${r.want}:${r.query}`);
    if (ref) out.set(r.key, ref);
  }
  return out;
}
