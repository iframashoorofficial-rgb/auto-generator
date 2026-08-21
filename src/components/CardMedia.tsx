"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaRef } from "@/lib/media";

/**
 * The card's media surface.
 *
 * Polymorphic on purpose: images and videos are the same slot, so a video
 * asset can drop in the day one exists without touching the card, the deck or
 * the recommender. Video plays muted and inline — the social-media default —
 * and only while it is actually on screen, so a deck of clips does not decode
 * five videos at once.
 */
export function CardMedia({
  media,
  className = "",
  active = true,
}: {
  media: MediaRef;
  className?: string;
  /** False for the card sitting behind the top one. */
  active?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [media.url]);

  useEffect(() => {
    const el = ref.current;
    if (!el || media.kind !== "video") return;
    if (active && media.autoplay !== false) {
      // Autoplay can still be refused; a poster frame is a fine outcome.
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active, media.kind, media.autoplay, media.url]);

  // A dead video URL should degrade to its poster, not to a broken card.
  if (media.kind === "video" && !failed) {
    return (
      <video
        ref={ref}
        className={className}
        src={media.url}
        poster={media.poster}
        muted
        loop
        playsInline
        preload={active ? "auto" : "metadata"}
        aria-label={media.alt || undefined}
        onError={() => setFailed(true)}
      />
    );
  }

  const src = failed ? media.poster : media.url;
  if (!src) return <div className={`${className} mediaFallback`} aria-hidden="true" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={media.alt ?? ""}
      draggable={false}
      loading={active ? "eager" : "lazy"}
    />
  );
}
