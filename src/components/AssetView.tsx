"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reelDuration, type ContentAsset } from "@/lib/assets";
import { findMedia } from "@/lib/media-sources";
import { CardMedia } from "./CardMedia";
import type { MediaRef } from "@/lib/media";

/**
 * The three finished formats, rendered as the thing you would post.
 *
 * Each renders 9:16 with the type composed over the media, so what the card
 * shows is what exports — not a description of it.
 */

function mediaFor(asset: ContentAsset, index: number): MediaRef {
  const slide = asset.slides[index];
  return (
    slide?.media ??
    findMedia({ ...slide?.mediaQuery, want: "image" }) ?? {
      kind: "image",
      url: "/packs/office-1.jpg",
      source: "stock",
    }
  );
}

/* ---- Carousel ----------------------------------------------------------- */

export function CarouselView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const [i, setI] = useState(0);
  const n = asset.slides.length;

  useEffect(() => setI(0), [asset.id]);

  const go = (d: number) => setI((p) => Math.min(n - 1, Math.max(0, p + d)));
  const slide = asset.slides[i];

  return (
    <div className="assetStage">
      <CardMedia media={mediaFor(asset, i)} className="ideaAsset" active={active} />
      <div className="ideaScrim" />

      <div className="slideCopy">
        <p className="slideIndex">
          {i + 1} / {n}
        </p>
        <h3 className="slideHead">{slide.headline}</h3>
        {slide.body && <p className="slideBody">{slide.body}</p>}
      </div>

      {/* Stop pointerdown reaching the deck so tapping arrows never swipes. */}
      <div className="slideNav" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className="navArrow"
          onClick={() => go(-1)}
          disabled={i === 0}
          aria-label="Previous slide"
        >
          ‹
        </button>
        <div className="dots" role="tablist" aria-label="Slides">
          {asset.slides.map((s, k) => (
            <button
              key={s.id}
              className={`dot${k === i ? " on" : ""}`}
              onClick={() => setI(k)}
              aria-label={`Slide ${k + 1}`}
              aria-selected={k === i}
              role="tab"
            />
          ))}
        </div>
        <button
          className="navArrow"
          onClick={() => go(1)}
          disabled={i === n - 1}
          aria-label="Next slide"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/* ---- Reel --------------------------------------------------------------- */

/**
 * Plays the beats on their own timeline.
 *
 * The timeline is the asset's, not the media's — so it behaves identically
 * whether the beat is backed by a clip or, as today, a still. Connecting a
 * video source changes nothing here.
 */
export function ReelView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const [beat, setBeat] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBeat(0);
    setPlaying(false);
  }, [asset.id]);

  // Never leave a card playing once it is off the top of the deck.
  useEffect(() => {
    if (!active) setPlaying(false);
  }, [active]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!playing) return;
    const hold = asset.slides[beat]?.durationMs ?? 2000;
    timer.current = setTimeout(() => {
      setBeat((b) => (b + 1 < asset.slides.length ? b + 1 : 0));
    }, hold);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, beat, asset.slides]);

  const slide = asset.slides[beat];
  const total = reelDuration(asset);
  const media = mediaFor(asset, beat);

  return (
    <div className="assetStage">
      <CardMedia
        media={{ ...media, autoplay: playing }}
        className="ideaAsset"
        active={active && playing}
      />
      <div className="ideaScrim" />

      {/* Beat progress, the familiar stories affordance. */}
      <div className="beatBar" aria-hidden="true">
        {asset.slides.map((s, k) => (
          <span key={s.id} className={`beatSeg${k <= beat ? " on" : ""}`} />
        ))}
      </div>

      <div className="reelCopy">
        <h3 className="reelText">{slide.headline}</h3>
        {slide.body && <p className="slideBody">{slide.body}</p>}
      </div>

      <div className="reelBar" onPointerDown={(e) => e.stopPropagation()}>
        <button
          className="navArrow"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          className="navArrow"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          title={asset.audioHint || undefined}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <span className="reelMeta">
          {(total / 1000).toFixed(1)}s · {asset.slides.length} beats
        </span>
      </div>
    </div>
  );
}

/* ---- Meme --------------------------------------------------------------- */

export function MemeView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const m = asset.meme;
  return (
    <div className="assetStage">
      <CardMedia media={mediaFor(asset, 0)} className="ideaAsset" active={active} />
      <div className="memeVeil" />
      {m?.reaction && (
        <div className="memeReaction">
          <CardMedia media={m.reaction} className="memeReactionMedia" active={active} />
        </div>
      )}
      <div className="memeText">
        {m?.topText && <p className="memeLine top">{m.topText}</p>}
        {m?.bottomText && <p className="memeLine bottom">{m.bottomText}</p>}
      </div>
      {asset.slides[0]?.headline && (
        <p className="memeCaptionOverlay">{asset.slides[0].headline}</p>
      )}
    </div>
  );
}

/**
 * The rant-over-footage format.
 *
 * One clip, one block of first-person text. The text sits in the safe zone —
 * never the bottom third, where TikTok and Instagram put the caption, the
 * username and the action rail — and the lines break naturally so it reads
 * like something typed, not laid out.
 */
export function ClipView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const slide = asset.slides[0];
  const lines = [slide?.headline, slide?.body].filter(Boolean).join("\n\n");

  return (
    <div className="assetStage">
      <CardMedia media={mediaFor(asset, 0)} className="ideaAsset" active={active} />
      <div className="clipVeil" />
      <div className="safeZone">
        <p className="clipText">{lines}</p>
      </div>
    </div>
  );
}

/* ---- Dispatcher --------------------------------------------------------- */

export function AssetView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const render = useCallback(() => {
    // Defence in depth. The store already drops cards it cannot render, but a
    // blank stage is a far better failure than a thrown render.
    if (!Array.isArray(asset.slides) || asset.slides.length === 0) {
      return (
        <div className="assetStage mediaFallback">
          <p className="memeCaptionOverlay">{asset.caption || "This card could not be rendered."}</p>
        </div>
      );
    }
    if (asset.kind === "clip") return <ClipView asset={asset} active={active} />;
    if (asset.kind === "reel") return <ReelView asset={asset} active={active} />;
    if (asset.kind === "meme") return <MemeView asset={asset} active={active} />;
    return <CarouselView asset={asset} active={active} />;
  }, [asset, active]);
  return render();
}
