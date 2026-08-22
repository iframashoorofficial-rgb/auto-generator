"use client";

import { useEffect, useRef, useState } from "react";

export interface MemeClip {
  src: string;
  /**
   * The beat this half carries.
   *
   * Never names what is on screen — the footage and the line are supposed to
   * fight each other. A caption that describes the video kills the joke.
   */
  caption: string;
}

export interface Meme {
  id: string;
  /** Shared across both halves. Holding it fixed is what makes the split read. */
  stamp: string;
  clips: MemeClip[];
  /**
   * A second line that lands late, once the setup has been sitting there.
   * Single-clip format only, where the delay is the punchline.
   */
  tag?: string;
}

/** Fraction of the clip that must elapse before a `tag` appears. */
const TAG_AT = 0.55;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * Flatten a meme into one readable sentence.
 *
 * A screen reader gets no timing and no split, so the delayed `tag` has to be
 * spoken alongside the setup or the joke arrives without its punchline. Empty
 * captions are dropped rather than read as a pause.
 */
function label(meme: Meme): string {
  const parts = [meme.clips.map((c) => c.caption).filter(Boolean).join(" / "), meme.tag]
    .filter(Boolean)
    .join(" — ");
  return parts ? `${meme.stamp}: ${parts}` : meme.stamp;
}

/**
 * One meme, rendered live in the browser rather than exported as a video file.
 *
 * The split-screen and delayed-caption formats are just two clips and some
 * timed text, so compositing them in CSS avoids an editing step entirely and
 * keeps the copy editable — changing a punchline is a string change, not a
 * re-render and re-upload.
 *
 * Muted and silent by design: the trending audio these formats use is licensed
 * by TikTok and Reels for posts on those platforms, and that licence does not
 * extend to a self-hosted page. The text carries it instead.
 */
export function MemeReel({ meme }: { meme: Meme }) {
  const reduced = usePrefersReducedMotion();
  const [late, setLate] = useState(false);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);

  const split = meme.clips.length > 1;

  // With motion suppressed the clip never plays, so the timed line would never
  // arrive. Show the whole joke at once instead of hiding half of it.
  const showTag = reduced || late;

  useEffect(() => {
    if (!reduced) return;
    for (const v of videos.current) v?.pause();
  }, [reduced]);

  return (
    <figure className="reel" aria-label={label(meme)}>
      <div className={`reelFrame${split ? " reelSplit" : ""}`}>
        {meme.clips.map((clip, i) => (
          <div className="reelPane" key={clip.src}>
            <video
              ref={(el) => {
                videos.current[i] = el;
              }}
              className="reelVideo"
              src={clip.src}
              muted
              loop
              playsInline
              autoPlay={!reduced}
              preload="metadata"
              // Only the first clip drives the timing, so two videos of
              // different lengths cannot fight over when the tag appears.
              onTimeUpdate={
                i === 0 && meme.tag
                  ? (e) => {
                      const v = e.currentTarget;
                      if (v.duration) setLate(v.currentTime / v.duration > TAG_AT);
                    }
                  : undefined
              }
            />
            {clip.caption && <span className="reelCaption">{clip.caption}</span>}
          </div>
        ))}

        <span className="reelStamp">{meme.stamp}</span>

        {meme.tag && (
          <span className={`reelTag${showTag ? " reelTagIn" : ""}`} aria-hidden={!showTag}>
            {meme.tag}
          </span>
        )}
      </div>
    </figure>
  );
}
