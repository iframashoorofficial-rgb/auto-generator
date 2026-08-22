"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaRef } from "@/lib/media";

/**
 * Plays a green-screen clip with the green removed.
 *
 * The reaction assets are green-screen sources — that is the whole reason they
 * were chosen, so the subject can sit on a generated backdrop instead of inside
 * a box. Browsers cannot chroma-key a `<video>`: there is no CSS for it, and
 * the usual answer is to pre-encode a WebM with an alpha channel. That needs
 * ffmpeg, which is not installed here, so the key happens per frame on a canvas
 * instead.
 *
 * Cheap enough in practice: the canvas is capped at a few hundred pixels wide
 * because the reaction is an inset, never full-bleed, so we are keying a
 * fraction of the pixels the source actually contains.
 */

/** Wider than the inset is ever drawn; keeps the per-frame pixel loop small. */
const MAX_W = 400;

/**
 * How far from pure green still counts as background.
 *
 * Green screens are never one flat colour — compression and spill smear them —
 * so the test is "green clearly dominates both other channels" rather than an
 * exact match.
 */
const DOMINANCE = 60;
/** Below this the pixel is basically black and keying it punches holes in hair. */
const FLOOR = 60;

/**
 * A frame with less subject than this is not a frame worth counting.
 *
 * These clips open on a beat of empty green, so "we drew something" is not the
 * same as "the reaction is on screen" — without this the give-up timer below
 * would be satisfied by frames that show nothing at all.
 */
const MIN_OPAQUE = 0.01;

/** How long to wait for a real keyed frame before giving up on keying. */
const FIRST_FRAME_MS = 2500;

/** Any channel below this counts as black for the purposes of the border scan. */
const DARK = 34;
/** A row is a border row if this share of it is black. Not 100%: JPEG-ish noise. */
const DARK_SHARE = 0.96;

/**
 * How much dead black frames the clip.
 *
 * These sources are re-uploads and several carry a border — a hairline in some,
 * proper letterbox bars in others. The old cover-crop hid it by accident; now
 * that the whole frame is drawn, it shows, and a keyed cut-out sitting in a
 * black rectangle stops looking cut out at all.
 *
 * Scans in from each edge for rows and columns that are essentially black, then
 * returns the largest rect of the ORIGINAL aspect that fits inside what is
 * left, centred on it. Keeping the aspect is what stops the fix becoming a
 * stretch — the card sized the box from the file's shape.
 */
function contentRect(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  vw: number,
  vh: number,
): { x: number; y: number; w: number; h: number } {
  const dark = (i: number) => data[i] < DARK && data[i + 1] < DARK && data[i + 2] < DARK;

  const rowDark = (y: number) => {
    let n = 0;
    for (let x = 0; x < w; x++) if (dark((y * w + x) * 4)) n++;
    return n / w >= DARK_SHARE;
  };
  const colDark = (x: number) => {
    let n = 0;
    for (let y = 0; y < h; y++) if (dark((y * w + x) * 4)) n++;
    return n / h >= DARK_SHARE;
  };

  let top = 0;
  while (top < h - 1 && rowDark(top)) top++;
  let bottom = h - 1;
  while (bottom > top && rowDark(bottom)) bottom--;
  let left = 0;
  while (left < w - 1 && colDark(left)) left++;
  let right = w - 1;
  while (right > left && colDark(right)) right--;

  // One pixel more on every side: the row where a bar meets the picture is a
  // blend of the two and survives the test above as a grey line.
  top += 1;
  left += 1;
  bottom -= 1;
  right -= 1;

  const scale = vw / w;
  let cx = left * scale;
  let cy = top * scale;
  let cw = (right - left + 1) * scale;
  let ch = (bottom - top + 1) * scale;
  if (cw <= 0 || ch <= 0) return { x: 0, y: 0, w: vw, h: vh };

  // Back to the file's aspect, centred on the content.
  const want = vw / vh;
  if (cw / ch > want) {
    const next = ch * want;
    cx += (cw - next) / 2;
    cw = next;
  } else {
    const next = cw / want;
    cy += (ch - next) / 2;
    ch = next;
  }
  return { x: cx, y: cy, w: cw, h: ch };
}

export function ChromaVideo({
  media,
  className = "",
  active = true,
}: {
  media: MediaRef;
  className?: string;
  active?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Keying is the intent, not a guarantee.
   *
   * If no keyed frame ever arrives — a codec the browser will not decode, a
   * blocked autoplay, a 2d context it refuses to hand over — the card used to
   * show an empty box, which is indistinguishable from "there is no video".
   * Falling back to the clip itself is worse-looking and far better than
   * nothing, and it is visible enough to be reported rather than guessed at.
   */
  const [keying, setKeying] = useState(true);
  /** Measured once per clip, from the first frame that has any picture in it. */
  const rect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    setKeying(true);
    rect.current = null;
  }, [media.url]);

  useEffect(() => {
    if (!keying) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      setKeying(false);
      return;
    }

    let raf = 0;
    let stopped = false;
    let landed = false;

    const draw = () => {
      if (stopped) return;
      raf = requestAnimationFrame(draw);

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh || video.readyState < 2) return;

      /*
       * The whole frame, never a crop.
       *
       * This used to cover-crop the clip into a portrait window, with a zoom
       * and then a focus point to say where that window sat. Every one of those
       * was a guess about footage nobody here can see, and each guess cut the
       * subject somewhere new — chin, forehead, or clean off the frame. The
       * only thing this component is actually for is removing the green.
       *
       * The canvas takes the clip's own shape and the card gives it a box of
       * the same shape, so nothing is cropped and nothing is stretched.
       */
      const w = Math.max(1, Math.min(MAX_W, Math.round(canvas.clientWidth || vw)));
      const h = Math.max(1, Math.round((w * vh) / vw));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const src = rect.current ?? { x: 0, y: 0, w: vw, h: vh };
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(video, src.x, src.y, src.w, src.h, 0, 0, w, h);

      // Throws if the source ever turns out to be cross-origin without CORS,
      // which taints the canvas. Better to show the clip than to throw inside
      // an animation frame, where nothing is left to catch it.
      let frame: ImageData;
      try {
        frame = ctx.getImageData(0, 0, w, h);
      } catch {
        stopped = true;
        setKeying(false);
        return;
      }
      const d = frame.data;
      let opaque = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        if (g > FLOOR && g - r > DOMINANCE && g - b > DOMINANCE) d[i + 3] = 0;
        else opaque++;
      }
      ctx.putImageData(frame, 0, 0);
      if (opaque / (w * h) > MIN_OPAQUE) landed = true;

      // Measured from the first frame with a subject in it, so an opening beat
      // of empty green cannot be mistaken for a frame that is all border.
      if (!rect.current && landed) rect.current = contentRect(d, w, h, vw, vh);
    };

    const start = () => {
      if (active) void video.play().catch(() => {});
      draw();
    };

    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });

    const giveUp = setTimeout(() => {
      if (!landed) setKeying(false);
    }, FIRST_FRAME_MS);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clearTimeout(giveUp);
      video.removeEventListener("loadeddata", start);
    };
  }, [media.url, active, keying]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) void v.play().catch(() => {});
    else v.pause();
  }, [active, keying]);

  if (!keying) {
    // Unkeyed, so the green is back — but a visible reaction beats an empty
    // card, and this branch is meant to be seen and fixed, not to sit quietly.
    return (
      <video
        ref={videoRef}
        className={className}
        src={media.url}
        muted
        loop
        playsInline
        autoPlay={active}
        preload="auto"
        aria-label={media.alt || undefined}
      />
    );
  }

  return (
    <>
      {/*
        The frame supply for the canvas. Transparent rather than `display: none`
        — Chrome disables the video track of an element it considers hidden, so
        a `display: none` source decodes nothing, the canvas stays empty, and
        the reaction never appears at all. It has to be laid out and painted to
        keep being decoded; `opacity: 0` behind the canvas is as hidden as it
        can safely get.
      */}
      <video
        ref={videoRef}
        className="chromaSource"
        src={media.url}
        muted
        loop
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        aria-hidden="true"
        tabIndex={-1}
      />
      <canvas ref={canvasRef} className={className} aria-label={media.alt || undefined} />
    </>
  );
}
