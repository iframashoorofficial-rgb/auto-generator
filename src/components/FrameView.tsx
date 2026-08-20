"use client";

import type { FormatDef, FrameDef } from "@/lib/formats";
import type { Pack, PhotoRole } from "@/lib/packs";

/**
 * Renders one frame at its true output size, scaled down by CSS transform.
 * Everything here is driven by the format definition — nothing assumes a
 * particular number of frames, lines, or beats.
 */
export function FrameView({
  format,
  frame,
  slots,
  pack,
  override,
  wordmark,
  scale,
}: {
  format: FormatDef;
  frame: FrameDef;
  slots: Record<string, string>;
  pack: Pack;
  override?: string;
  wordmark: string;
  scale: number;
}) {
  const avail = format.width - frame.box.left - frame.box.right;
  const src = override || pack.photos[frame.photo as PhotoRole] || pack.photos.establish;

  return (
    <div
      className="frameOuter"
      style={{ width: format.width * scale, height: format.height * scale }}
    >
      <div
        className="frameInner"
        style={{
          width: format.width,
          height: format.height,
          transform: `scale(${scale})`,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="framePhoto" src={src} alt={frame.alt} />
        <div className="frameScrim" style={{ background: frame.scrim }} />

        <div
          className="frameType"
          style={{
            top: frame.box.top,
            left: frame.box.left,
            right: frame.box.right,
            gap: frame.box.gap,
          }}
        >
          {frame.lines.map((line, i) => {
            const text = (slots[line.slot] ?? "").trim();
            return (
              <div
                key={`${line.slot}-${i}`}
                className="frameLine"
                style={{
                  fontSize: fitSize(text, line.size, avail),
                  fontWeight: line.weight,
                }}
              >
                {text}
              </div>
            );
          })}

          {frame.arrow && (
            <div className="frameArrow">
              <svg width="96" height="188" viewBox="0 0 96 188" fill="none" aria-hidden="true">
                <path
                  d="M48 6 V172 M12 136 L48 176 L84 136"
                  stroke="#ffffff"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        {frame.wordmark && wordmark && (
          <div className="frameMark">{wordmark.toLowerCase()}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Shrink a line until it fits its box. Display type must never wrap — a
 * wrapped headline destroys the hierarchy these layouts depend on.
 */
function fitSize(text: string, base: number, avail: number): number {
  if (!text) return base;
  const estimated = base * 0.54 * text.length;
  if (estimated <= avail) return base;
  return Math.max(30, Math.floor(base * (avail / estimated)));
}
