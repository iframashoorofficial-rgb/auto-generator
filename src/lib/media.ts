/**
 * Media references.
 *
 * Kept deliberately separate from *producing* media. A card needs to display
 * whatever asset an idea happens to have — a stock still today, a generated
 * image once someone pays for one, a video clip once anything in the system
 * can produce or source one. Nothing here generates anything.
 *
 * A reference is either a URL (persistable) or an inline data URL (session
 * only, because base64 blobs must never reach localStorage).
 */

export type MediaKind = "image" | "video";

export interface MediaRef {
  kind: MediaKind;
  /** Image src, or video src. May be a path, an absolute URL, or a data URL. */
  url: string;
  /** Still shown before/behind a video. Required in practice for good UX. */
  poster?: string;
  /** Descriptive alt text. Empty string means decorative. */
  alt?: string;
  /** Where it came from — drives the badge and whether it can be persisted. */
  source?: "stock" | "generated" | "external";
  /** Autoplay muted inline, the social-media default for previews. */
  autoplay?: boolean;
}

/** data: URLs carry the bytes inline, so they cannot be persisted. */
export function isInline(ref: MediaRef | undefined): boolean {
  return !!ref && ref.url.startsWith("data:");
}

/**
 * Strip anything that must not be written to storage.
 *
 * Returns undefined when the whole reference was inline, so a restored card
 * falls back to its stock preview rather than a broken image.
 */
export function persistableMedia(ref: MediaRef | undefined): MediaRef | undefined {
  if (!ref) return undefined;
  if (isInline(ref)) {
    // Keep a non-inline poster if there is one; drop the payload.
    if (ref.poster && !ref.poster.startsWith("data:")) {
      return { kind: "image", url: ref.poster, source: ref.source, alt: ref.alt };
    }
    return undefined;
  }
  const out: MediaRef = { ...ref };
  if (out.poster?.startsWith("data:")) delete out.poster;
  return out;
}

export function imageRef(
  url: string,
  source: MediaRef["source"] = "stock",
  alt = "",
): MediaRef {
  return { kind: "image", url, source, alt };
}

export function videoRef(
  url: string,
  poster?: string,
  source: MediaRef["source"] = "external",
): MediaRef {
  return { kind: "video", url, poster, source, autoplay: true };
}
