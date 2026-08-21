"use client";

import { useEffect, useState } from "react";
import {
  CAROUSEL_MAX,
  assetLabel,
  publishProblems,
  slideId,
  type AssetSlide,
  type ContentAsset,
} from "@/lib/assets";

/**
 * Edit a finished asset.
 *
 * The controls follow the format: a reel edits beat text and timing, a meme
 * edits its overlay, a carousel edits, reorders and regenerates individual
 * slides. Text edits are always local — regenerating a slide's visual costs
 * money, so it stays a separate explicit button.
 */
export function IdeaEditor({
  idea,
  onSave,
  onCancel,
  onRegenerateSlide,
  regenerating,
}: {
  idea: ContentAsset;
  onSave: (next: ContentAsset) => void;
  onCancel: () => void;
  /** Paid, per slide. Optional so the editor works without it. */
  onRegenerateSlide?: (asset: ContentAsset, slideIndex: number) => void;
  regenerating?: Record<string, boolean>;
}) {
  const [draft, setDraft] = useState<ContentAsset>(idea);

  useEffect(() => setDraft(idea), [idea]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const setSlide = (i: number, patch: Partial<AssetSlide>) =>
    setDraft((d) => ({
      ...d,
      slides: d.slides.map((s, k) => (k === i ? { ...s, ...patch } : s)),
    }));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const j = i + dir;
      if (j < 0 || j >= d.slides.length) return d;
      const slides = [...d.slides];
      [slides[i], slides[j]] = [slides[j], slides[i]];
      return { ...d, slides };
    });

  const addSlide = () =>
    setDraft((d) => ({
      ...d,
      slides: [
        ...d.slides,
        {
          id: slideId(d.slides.length),
          headline: "",
          mediaQuery: { subject: "", environment: "", shotType: "", styleKeywords: [] },
        },
      ],
    }));

  const removeSlide = (i: number) =>
    setDraft((d) => ({ ...d, slides: d.slides.filter((_, k) => k !== i) }));

  const problems = publishProblems(draft);

  return (
    <div className="sheetWrap" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="editTitle">
        <div className="sheetHead">
          <h2 id="editTitle">Edit {assetLabel(idea.kind).toLowerCase()}</h2>
          <button className="mini" onClick={onCancel}>
            Close
          </button>
        </div>

        <p className="hint sheetNote">
          Text edits are free and instant. Regenerating a slide&apos;s visual is the only
          action here that costs anything.
        </p>

        <div className="sheetGrid">
          <div className="bfield">
            <label className="fieldLabel" htmlFor="ed-caption">
              Caption
            </label>
            <textarea
              id="ed-caption"
              rows={3}
              value={draft.caption}
              onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))}
            />
          </div>

          <div className="bfield">
            <label className="fieldLabel" htmlFor="ed-tags">
              Hashtags
            </label>
            <input
              id="ed-tags"
              type="text"
              value={draft.hashtags.join(" ")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  hashtags: e.target.value.split(/\s+/).filter(Boolean),
                }))
              }
            />
          </div>

          <div className="bfield">
            <label className="fieldLabel" htmlFor="ed-platform">
              Platform
            </label>
            <input
              id="ed-platform"
              type="text"
              value={draft.platform}
              onChange={(e) => setDraft((d) => ({ ...d, platform: e.target.value }))}
            />
          </div>

          {/* ---- Meme-specific ---- */}
          {draft.kind === "meme" && (
            <>
              <div className="bfield">
                <label className="fieldLabel" htmlFor="ed-top">
                  Meme text — top
                </label>
                <input
                  id="ed-top"
                  type="text"
                  value={draft.meme?.topText ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      meme: { topText: e.target.value, bottomText: d.meme?.bottomText ?? "" },
                    }))
                  }
                />
              </div>
              <div className="bfield">
                <label className="fieldLabel" htmlFor="ed-bottom">
                  Meme text — bottom
                </label>
                <input
                  id="ed-bottom"
                  type="text"
                  value={draft.meme?.bottomText ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      meme: { topText: d.meme?.topText ?? "", bottomText: e.target.value },
                    }))
                  }
                />
              </div>
            </>
          )}

          {/* ---- Reel-specific ---- */}
          {draft.kind === "reel" && (
            <div className="bfield">
              <label className="fieldLabel" htmlFor="ed-audio">
                Sound direction
              </label>
              <input
                id="ed-audio"
                type="text"
                value={draft.audioHint ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, audioHint: e.target.value }))}
              />
            </div>
          )}
        </div>

        {/* ---- Slides / beats ---- */}
        <p className="whyTitle slidesTitle">
          {draft.kind === "reel" ? "Beats" : draft.kind === "meme" ? "Background" : "Slides"}
        </p>

        <div className="slideList">
          {draft.slides.map((s, i) => (
            <div className="slideEdit" key={s.id}>
              <div className="slideEditHead">
                <span className="slideNo">{i + 1}</span>
                <div className="slideEditActions">
                  {draft.kind === "carousel" && (
                    <>
                      <button className="mini" onClick={() => move(i, -1)} disabled={i === 0}>
                        ↑
                      </button>
                      <button
                        className="mini"
                        onClick={() => move(i, 1)}
                        disabled={i === draft.slides.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        className="mini"
                        onClick={() => removeSlide(i)}
                        disabled={draft.slides.length <= 1}
                      >
                        Remove
                      </button>
                    </>
                  )}
                  {onRegenerateSlide && (
                    <button
                      className="mini"
                      onClick={() => onRegenerateSlide(draft, i)}
                      disabled={regenerating?.[s.id]}
                      title="Regenerates only this slide's image (~4¢)"
                    >
                      {regenerating?.[s.id] ? "Painting…" : "Regenerate visual"}
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={2}
                value={s.headline}
                placeholder="On-screen text"
                onChange={(e) => setSlide(i, { headline: e.target.value })}
                aria-label={`Slide ${i + 1} headline`}
              />
              <input
                type="text"
                value={s.body ?? ""}
                placeholder="Supporting line (optional)"
                onChange={(e) => setSlide(i, { body: e.target.value })}
                aria-label={`Slide ${i + 1} body`}
              />

              <div className="slideMetaRow">
                <input
                  type="text"
                  value={s.mediaQuery.subject}
                  placeholder="Shot subject"
                  onChange={(e) =>
                    setSlide(i, { mediaQuery: { ...s.mediaQuery, subject: e.target.value } })
                  }
                  aria-label={`Slide ${i + 1} subject`}
                />
                {draft.kind === "reel" && (
                  <label className="durField">
                    <span className="bfHint">Hold</span>
                    <input
                      type="number"
                      min={1200}
                      max={4000}
                      step={100}
                      value={s.durationMs ?? 2000}
                      onChange={(e) => setSlide(i, { durationMs: Number(e.target.value) })}
                      aria-label={`Beat ${i + 1} duration in milliseconds`}
                    />
                    <span className="bfHint">ms</span>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {draft.kind === "carousel" && draft.slides.length < CAROUSEL_MAX && (
          <button className="mini" onClick={addSlide}>
            Add slide
          </button>
        )}

        {problems.length > 0 && (
          <p className="error editWarn">
            Not postable yet: {problems.join("; ")}.
          </p>
        )}

        <div className="sheetFoot">
          <button
            className="primary"
            onClick={() => onSave(draft)}
            disabled={problems.length > 0}
          >
            Save changes
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
