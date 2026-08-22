"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { reelDuration, type ContentAsset } from "@/lib/assets";
import { findMedia } from "@/lib/media-sources";
import { CardMedia } from "./CardMedia";
import { assetById, type TemplateSlot } from "@/lib/meme-library";
import { ChromaVideo } from "./ChromaVideo";
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

/**
 * Average glyph advance at weight 700, as a fraction of the font size.
 *
 * Two figures because `.tmplOutlined` uppercases what it is given, and capitals
 * are appreciably wider — measuring an outlined slot in lowercase advances is
 * how it ends up one line taller than the box it was given.
 */
const GLYPH_W = { mixed: 0.53, upper: 0.63 };
/** Matches `line-height` on `.tmplSlot`. */
const SLOT_LEADING = 1.12;
/** Lines break between words, so one never quite fills the width it is given. */
const WRAP_SLACK = 0.88;

/**
 * Font size for one template slot, as a fraction of the artwork's width.
 *
 * The artwork's width is the only unit a slot can be sized in: everything about
 * a slot is a percentage of the template, and the template is letterboxed, so
 * neither the card nor the viewport tells you how big the picture actually is.
 *
 * Two bounds, smaller wins — the line has to fit the slot's width once broken
 * over `maxLines`, and `maxLines` has to fit the slot's height. A single flat
 * size for every slot on every template is what put long lines outside their
 * box, where the line clamp cut them off and the text appeared to vanish.
 *
 * The floor is deliberately low. Nothing enforces a slot's `maxChars` — it is
 * guidance in the prompt — so when a slot is overwritten the choice is between
 * small and missing, and small is the better failure.
 */
function slotScale(slot: TemplateSlot, text: string, aspect: number): number {
  const chars = Math.max(text.trim().length, 1);
  const glyph = GLYPH_W[slot.style === "outlined" ? "upper" : "mixed"];
  const byWidth = ((slot.width / 100) * WRAP_SLACK * slot.maxLines) / (glyph * chars);
  // The slot's height is a share of the artwork's height — its width / aspect.
  const byHeight = slot.height / 100 / aspect / (slot.maxLines * SLOT_LEADING);
  return Math.min(0.075, Math.max(0.019, Math.min(byWidth, byHeight)));
}

export function MemeView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const m = asset.meme;
  const lib = m?.templateId ? assetById(m.templateId) : undefined;

  // A template positions its own text: the artwork is fixed and the slots were
  // measured against it, so each one is placed absolutely rather than stacked.
  if (lib?.kind === "template" && m?.slots) {
    return (
      <div className="assetStage">
        {/* The frame is the card; the box inside it is the picture, letterboxed
            to the template's own shape. The artwork is never cropped — a
            template is the joke, so losing half of it to a 9:16 card loses the
            joke — and because the slots are positioned inside that same box,
            their percentages land exactly where they were measured. */}
        <div className="tmplFrame" style={{ background: lib.background }}>
          <div
            className="tmplBox"
            style={{ "--tmpl-aspect": String(lib.aspect) } as CSSProperties}
          >
            <CardMedia media={mediaFor(asset, 0)} className="tmplArt" active={active} />
            {lib.slots.map((slot) => {
              const text = m.slots?.[slot.name];
              if (!text) return null;
              return (
                <span
                  key={slot.name}
                  className={`tmplSlot ${slot.style === "outlined" ? "tmplOutlined" : "tmplDark"}`}
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                    textAlign: slot.align,
                    transform: slot.rotate ? `rotate(${slot.rotate}deg)` : undefined,
                    fontSize: `calc(var(--tmpl-w) * ${slotScale(slot, text, lib.aspect).toFixed(4)})`,
                  }}
                >
                  <span
                    className="tmplSlotText"
                    style={{ WebkitLineClamp: slot.maxLines }}
                  >
                    {text}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // A reaction floats over ambient footage with the setup text above it. The
  // clip is keyed to transparency, so it gets no border — a box would make it
  // read as a video thumbnail rather than a meme.
  if (lib?.kind === "reaction" && m?.slots) {
    const beats = lib.setupSlots.map((b) => m.slots?.[b.name]).filter(Boolean) as string[];
    return (
      <div className="assetStage">
        <CardMedia media={mediaFor(asset, 0)} className="ideaAsset" active={active} />
        <div className="memeVeil" />
        <div className="reactStack">
          <div className="reactText">
            {beats.map((line, i) => (
              <p className="reactLine" key={i}>
                {line}
              </p>
            ))}
          </div>
          {m.reaction && (
            <div
              className={`reactCut${lib.transparent ? "" : " reactBoxed"}`}
              data-x={lib.place.x}
              data-full={lib.place.full ? "true" : undefined}
              style={
                {
                  "--react-h": String(Math.min(lib.size, lib.maxSize)),
                  "--react-frame": String(lib.frame),
                  "--react-lift": String(lib.place.lift),
                } as CSSProperties
              }
            >
              {/* A green-screen source keyed per frame. Without this the card
                  shows a green rectangle, which is what the green screen was
                  chosen to avoid. */}
              {lib.transparent ? (
                <ChromaVideo media={m.reaction} className="reactMedia" active={active} />
              ) : (
                <CardMedia media={m.reaction} className="reactMedia" active={active} />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Legacy two-slot memes, made before the library existed. Kept so nobody's
  // saved cards break.
  return (
    <div className="assetStage">
      <CardMedia media={mediaFor(asset, 0)} className="ideaAsset" active={active} />
      <div className="memeVeil" />
      <div className={`memeText${m?.reaction ? " hasInset" : ""}`}>
        {m?.topText && <p className="memeLine top">{m.topText}</p>}
        {m?.reaction && (
          <div className="memeReaction">
            <CardMedia media={m.reaction} className="memeReactionMedia" active={active} />
          </div>
        )}
        {m?.bottomText && <p className="memeLine bottom">{m.bottomText}</p>}
      </div>
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
/**
 * Size the rant so it always fits the safe band.
 *
 * A fixed size clipped anything long, which is what made text disappear at
 * random — the cut depended entirely on how much the model happened to write.
 * Sizing from the actual length means a 30-word post is comfortable and a
 * 70-word one is merely small, but never truncated.
 */
function clipFontSize(chars: number): number {
  if (chars <= 120) return 19;
  if (chars <= 200) return 17;
  if (chars <= 300) return 15;
  if (chars <= 420) return 13.5;
  return 12;
}

export function ClipView({ asset, active }: { asset: ContentAsset; active: boolean }) {
  const slide = asset.slides[0];
  const raw = [slide?.headline, slide?.body].filter(Boolean).join("\n\n");
  const lines = raw.split("\n").map((l) => l.trim());
  const size = clipFontSize(raw.length);

  return (
    <div className="assetStage">
      <CardMedia media={mediaFor(asset, 0)} className="ideaAsset" active={active} />
      <div className="clipVeil" />
      <div className="safeZone">
        <div className="clipText" style={{ fontSize: `${size}px` }}>
          {lines.map((line, i) =>
            line ? (
              <span className="clipLine" key={i}>
                {line}
              </span>
            ) : (
              <span className="clipGap" key={i} aria-hidden="true" />
            ),
          )}
        </div>
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
