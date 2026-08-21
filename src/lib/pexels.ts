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
  /**
   * Words that must lead the search — the brand's sector, for formats whose
   * imagery is supposed to look like the business. Without this a bookkeeping
   * carousel searched "clean desk closed laptop" and returned any desk on the
   * internet, which is why the footage never looked like the company.
   */
  boost?: string;
}): string {
  const lead = (meta.boost ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2);

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

  // Long queries return nothing from Pexels; a handful of nouns does best,
  // and the sector goes first so it dominates the match.
  const rest = words.filter((w) => !lead.includes(w)).slice(0, lead.length ? 3 : 5);
  return [...lead, ...rest].join(" ") || meta.context || "person walking city";
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

/** 9 / 16 — the shape of the card and of both platforms. */
const TARGET_RATIO = 16 / 9;

/**
 * Score one file. Lower is better.
 *
 * Distance from 9:16 dominates, because that is what causes the visible
 * damage: a 1:1 clip stretched to fill a 9:16 frame loses a third of its
 * width, which is how you end up looking at a wall or the top of someone's
 * head. Resolution is a mild tie-breaker — 540-1200px tall is the sweet spot
 * between looking sharp and making the browser decode a 4K file.
 */
function scoreFile(f: PexelsVideoFile): number {
  const w = f.width ?? 0;
  const h = f.height ?? 0;
  if (!w || !h) return Infinity;
  const ratio = h / w;
  if (ratio < 1.4) return Infinity; // square or landscape: unusable here
  const shape = Math.abs(ratio - TARGET_RATIO) * 10;
  // Graded, not a cliff: with a flat penalty, a 360x640 file tied with a
  // 540x960 one on shape and won on encounter order, so the card got the
  // blurrier clip for no reason. Below 720 tall looks soft on a phone; above
  // 1600 is bytes the browser decodes and nobody sees.
  const size = h < 720 ? (720 - h) / 200 : h > 1600 ? (h - 1600) / 800 : 0;
  return shape + size;
}

/**
 * A vertical clip suited to a 9:16 card, or null.
 *
 * Considers every candidate rather than taking the first result: the API
 * returns them by relevance, not by how well they crop, and the first hit was
 * often the worst-shaped one.
 */
export async function findVideo(query: string): Promise<MediaRef | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || !query) return null;

  const url = `${VIDEO_ENDPOINT}?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10&size=medium`;
  const data = await call<{ videos?: PexelsVideo[] }>(url, key);
  const videos = data?.videos ?? [];
  if (!videos.length) return null;

  let best: { file: PexelsVideoFile; poster?: string; score: number } | null = null;
  for (const v of videos) {
    for (const f of v.video_files ?? []) {
      if (f.file_type !== "video/mp4" || !f.link) continue;
      const score = scoreFile(f);
      if (score === Infinity) continue;
      if (!best || score < best.score) best = { file: f, poster: v.image, score };
    }
  }

  if (!best) return null;
  return videoRef(best.file.link, best.poster, "external");
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
