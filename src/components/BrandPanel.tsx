"use client";

import { useState } from "react";
import {
  type BrandProfile,
  type VisualDNA,
  mergeBrand,
  mergeVisual,
} from "@/lib/brand";
import { defaultVisual, styleSignature } from "@/lib/visual-prompt";

/**
 * The editable brand record.
 *
 * Everything the assistant learns is visible and correctable here — a memory
 * the user cannot see or fix is worse than no memory, because wrong facts
 * silently poison every future carousel.
 */
export function BrandPanel({
  brand,
  onChange,
}: {
  brand: BrandProfile;
  onChange: (update: (b: BrandProfile) => BrandProfile) => void;
}) {
  const [tab, setTab] = useState<"brand" | "visual">("brand");

  const setBusiness = (key: string, value: string) =>
    onChange((b) => mergeBrand(b, { business: { [key]: value } }));

  const setList = (key: "contentGoals" | "platforms", value: string) =>
    onChange((b) => ({
      ...b,
      [key]: value.split(",").map((s) => s.trim()).filter(Boolean),
      updatedAt: Date.now(),
    }));

  const setVisual = (patch: Partial<VisualDNA>) =>
    onChange((b) => ({ ...b, visual: mergeVisual(b.visual, patch), updatedAt: Date.now() }));

  const visual = brand.visual;
  const hasVisual = Boolean(visual.aesthetic || visual.palette.length);

  return (
    <div className="panel">
      <div className="brandHead">
        <h2>Brand memory</h2>
        <div className="tabs">
          <button
            className="mini"
            aria-pressed={tab === "brand"}
            onClick={() => setTab("brand")}
          >
            Profile
          </button>
          <button
            className="mini"
            aria-pressed={tab === "visual"}
            onClick={() => setTab("visual")}
          >
            Visual DNA
          </button>
        </div>
      </div>

      {tab === "brand" ? (
        <div className="brandGrid">
          <Field label="Brand" value={brand.business.name} onChange={(v) => setBusiness("name", v)} />
          <Field label="Website" value={brand.website}
            onChange={(v) => onChange((b) => ({ ...b, website: v, updatedAt: Date.now() }))} />
          <Field label="What you do" value={brand.business.offering} onChange={(v) => setBusiness("offering", v)} area />
          <Field label="Audience" value={brand.business.audience} onChange={(v) => setBusiness("audience", v)} area />
          <Field label="Value proposition" value={brand.business.edge} onChange={(v) => setBusiness("edge", v)} area />
          <Field label="Problem you solve" value={brand.business.problem} onChange={(v) => setBusiness("problem", v)} area />
          <Field label="Positioning" value={brand.positioning}
            onChange={(v) => onChange((b) => ({ ...b, positioning: v, updatedAt: Date.now() }))} area />
          <Field label="Tone / voice" value={brand.business.voice} onChange={(v) => setBusiness("voice", v)} area />
          <Field label="Content goals" value={brand.contentGoals.join(", ")}
            onChange={(v) => setList("contentGoals", v)} hint="Comma separated" />
          <Field label="Platforms" value={brand.platforms.join(", ")}
            onChange={(v) => setList("platforms", v)} hint="Comma separated" />
          <Field label="Call to action" value={brand.business.callToAction} onChange={(v) => setBusiness("callToAction", v)} />
          <Field label="Never claim" value={brand.business.avoid.join(", ")}
            onChange={(v) =>
              onChange((b) => mergeBrand(b, {
                business: { avoid: v.split(",").map((s) => s.trim()).filter(Boolean) },
              }))
            }
            hint="Comma separated" />
        </div>
      ) : (
        <>
          <p className="hint brandIntro">
            Every generated image is built from this block plus the carousel and the
            individual slide — which is what keeps a set looking like one shoot.
          </p>

          {!hasVisual && (
            <button
              className="mini"
              onClick={() => setVisual(defaultVisual(brand.business.sector))}
            >
              Start from a sensible house style
            </button>
          )}

          <div className="brandGrid">
            <Field label="Aesthetic" value={visual.aesthetic} onChange={(v) => setVisual({ aesthetic: v })} area />
            <Field label="Colours" value={visual.palette.join(", ")}
              onChange={(v) => setVisual({ palette: v.split(",").map((s) => s.trim()).filter(Boolean) })}
              hint="Comma separated" />
            <Field label="Photography" value={visual.photography} onChange={(v) => setVisual({ photography: v })} area />
            <Field label="Lighting" value={visual.lighting} onChange={(v) => setVisual({ lighting: v })} area />
            <Field label="Composition" value={visual.composition} onChange={(v) => setVisual({ composition: v })} area />
            <Field label="Mood" value={visual.mood} onChange={(v) => setVisual({ mood: v })} />
            <Field label="Realism" value={visual.realism} onChange={(v) => setVisual({ realism: v })} />
            <Field label="Texture" value={visual.texture} onChange={(v) => setVisual({ texture: v })} />
            <Field label="Recurring people / products" value={visual.recurring} onChange={(v) => setVisual({ recurring: v })} area />
            <Field label="Never show" value={visual.avoid.join(", ")}
              onChange={(v) => setVisual({ avoid: v.split(",").map((s) => s.trim()).filter(Boolean) })}
              hint="Comma separated" />
          </div>

          {hasVisual && (
            <p className="hint">
              Style signature <code className="sig">{styleSignature(visual)}</code>
              {visual.locked ? " · locked for future carousels" : " · not locked yet"}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  area,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  area?: boolean;
  hint?: string;
}) {
  const id = `bf-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="bfield">
      <label className="fieldLabel" htmlFor={id}>
        {label}
      </label>
      {area ? (
        <textarea id={id} rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="bfHint">{hint}</span>}
    </div>
  );
}
