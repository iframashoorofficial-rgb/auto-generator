/**
 * Exports a frame to a real PNG at full output size.
 *
 * This draws to canvas rather than rasterising the DOM. The frames are simple
 * enough that canvas gives pixel-exact output, and it sidesteps the font and
 * CORS failures that DOM-screenshot libraries bring with them.
 *
 * Everything here mirrors the CSS in `globals.css` and the layout in
 * `FrameView.tsx`. Where a number appears in both, it comes from `fit.ts`.
 */

import type { FormatDef, FrameDef } from "./formats";
import {
  FRAME_FONT,
  FRAME_LETTER_SPACING,
  FRAME_LINE_HEIGHT,
  fitSize,
} from "./fit";

/** One stop of a vertical CSS gradient. */
interface Stop {
  color: string;
  at: number;
}

/**
 * Parse the `linear-gradient(180deg, rgba(...) N%, ...)` strings the format
 * definitions use. Only the vertical form is supported — that is all the
 * scrims are. Anything else falls back to a flat wash so an export never
 * fails outright over a gradient.
 */
export function parseVerticalGradient(css: string): Stop[] {
  const inner = css.match(/linear-gradient\(([\s\S]*)\)\s*$/);
  if (!inner) return [{ color: "rgba(0,0,0,0.45)", at: 0 }, { color: "rgba(0,0,0,0.45)", at: 1 }];

  const body = inner[1];
  if (!/^\s*180deg/.test(body)) {
    return [{ color: "rgba(0,0,0,0.45)", at: 0 }, { color: "rgba(0,0,0,0.45)", at: 1 }];
  }

  // Split on commas that are not inside rgba(...) parentheses.
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);

  const stops: Stop[] = [];
  for (const part of parts.slice(1)) {
    const m = part.trim().match(/^(.*?)\s+(-?[\d.]+)%$/);
    if (!m) continue;
    const at = Math.min(1, Math.max(0, parseFloat(m[2]) / 100));
    stops.push({ color: m[1].trim(), at });
  }

  if (!stops.length) {
    return [{ color: "rgba(0,0,0,0.45)", at: 0 }, { color: "rgba(0,0,0,0.45)", at: 1 }];
  }
  return stops;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Same-origin (/packs/...) and data: URLs both stay untainted.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

/** Draw an image cover-fit into a box, matching CSS `object-fit: cover`. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/**
 * CSS centres a line box of `line-height` around the glyphs. Reproduce that
 * half-leading so exported baselines sit where the preview puts them.
 */
function baselineFor(ctx: CanvasRenderingContext2D, text: string, size: number, top: number) {
  const m = ctx.measureText(text || "H");
  const ascent = m.fontBoundingBoxAscent || size * 0.905;
  const descent = m.fontBoundingBoxDescent || size * 0.212;
  const lineBox = size * FRAME_LINE_HEIGHT;
  return top + (lineBox - (ascent + descent)) / 2 + ascent;
}

/** The layered dark outline from `.frameLine`, approximated with a stroke. */
function paintLine(ctx: CanvasRenderingContext2D, text: string, cx: number, baseline: number, size: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.62)";
  ctx.lineWidth = Math.max(4, size * 0.045);
  ctx.strokeText(text, cx, baseline);
  ctx.restore();

  // Second pass without the blur tightens the edge, as the stacked
  // text-shadows do in CSS.
  ctx.save();
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = Math.max(3, size * 0.03);
  ctx.strokeText(text, cx, baseline);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, cx, baseline);
}

export interface RenderInput {
  format: FormatDef;
  frame: FrameDef;
  slots: Record<string, string>;
  photoSrc: string;
  wordmark: string;
}

export async function renderFrame({
  format,
  frame,
  slots,
  photoSrc,
  wordmark,
}: RenderInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = format.width;
  canvas.height = format.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  // Photo
  try {
    const img = await loadImage(photoSrc);
    drawCover(ctx, img, format.width, format.height);
  } catch {
    ctx.fillStyle = "#0a0b0d";
    ctx.fillRect(0, 0, format.width, format.height);
  }

  // Scrim
  const grad = ctx.createLinearGradient(0, 0, 0, format.height);
  for (const stop of parseVerticalGradient(frame.scrim)) {
    grad.addColorStop(stop.at, stop.color);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, format.width, format.height);

  // Type
  const avail = format.width - frame.box.left - frame.box.right;
  const cx = frame.box.left + avail / 2;
  let y = frame.box.top;

  const spacingSupported = "letterSpacing" in ctx;

  for (const line of frame.lines) {
    const text = (slots[line.slot] ?? "").trim();
    const size = fitSize(text, line.size, avail);

    ctx.font = `${line.weight} ${size}px ${FRAME_FONT}`;
    if (spacingSupported) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${FRAME_LETTER_SPACING * size}px`;
    }

    if (text) paintLine(ctx, text, cx, baselineFor(ctx, text, size, y), size);
    y += size * FRAME_LINE_HEIGHT + frame.box.gap;
  }

  if (spacingSupported) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  }

  // Arrow — the same path the preview draws, offset by its CSS margin.
  if (frame.arrow) {
    const arrowTop = y - frame.box.gap + 76;
    ctx.save();
    ctx.translate(cx - 48, arrowTop);
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(48, 6);
    ctx.lineTo(48, 172);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 136);
    ctx.lineTo(48, 176);
    ctx.lineTo(84, 136);
    ctx.stroke();
    ctx.restore();
  }

  // Wordmark
  if (frame.wordmark && wordmark) {
    const size = 30;
    ctx.font = `600 ${size}px ${FRAME_FONT}`;
    if (spacingSupported) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${0.26 * size}px`;
    }
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // `bottom: 150px` positions the line box; approximate its baseline.
    ctx.fillText(wordmark.toLowerCase(), format.width / 2, format.height - 150 + size * 0.78);
    ctx.restore();
    if (spacingSupported) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not encode the PNG."));
    }, "image/png");
  });
}

/** Hand a rendered frame to the browser as a download. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
