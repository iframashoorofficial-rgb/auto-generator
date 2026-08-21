"use client";

import { useEffect, useState } from "react";
import {
  CONTENT_FORMATS,
  EDITABLE_FIELDS,
  type ContentIdea,
} from "@/lib/ideas";

/**
 * Edit one idea.
 *
 * Two rules shape this. Changing the hook must not rewrite the concept, and
 * editing any text must never trigger image generation — that costs money, so
 * it stays an explicit, separate click. Everything here is a local edit
 * applied on save.
 */
export function IdeaEditor({
  idea,
  onSave,
  onCancel,
}: {
  idea: ContentIdea;
  onSave: (next: ContentIdea) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ContentIdea>(idea);

  useEffect(() => setDraft(idea), [idea]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const set = (key: keyof ContentIdea, value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="sheetWrap" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="editTitle">
        <div className="sheetHead">
          <h2 id="editTitle">Edit idea</h2>
          <button className="mini" onClick={onCancel}>
            Close
          </button>
        </div>

        <p className="hint sheetNote">
          Changing text here never regenerates an image — the visual only changes when you
          ask for one.
        </p>

        <div className="sheetGrid">
          <div className="bfield">
            <label className="fieldLabel" htmlFor="ed-format">
              Format
            </label>
            <select
              id="ed-format"
              value={draft.formatType}
              onChange={(e) => set("formatType", e.target.value)}
            >
              {CONTENT_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bfield">
            <label className="fieldLabel" htmlFor="ed-platform">
              Platform
            </label>
            <input
              id="ed-platform"
              type="text"
              value={draft.platform}
              onChange={(e) => set("platform", e.target.value)}
            />
          </div>

          {EDITABLE_FIELDS.map((f) => (
            <div className="bfield" key={String(f.key)}>
              <label className="fieldLabel" htmlFor={`ed-${String(f.key)}`}>
                {f.label}
              </label>
              {f.area ? (
                <textarea
                  id={`ed-${String(f.key)}`}
                  rows={2}
                  value={String(draft[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  id={`ed-${String(f.key)}`}
                  type="text"
                  value={String(draft[f.key] ?? "")}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}

          <div className="bfield">
            <label className="fieldLabel" htmlFor="ed-scenes">
              Scenes
            </label>
            <textarea
              id="ed-scenes"
              rows={3}
              value={draft.scenes.join("\n")}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  scenes: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                }))
              }
            />
            <span className="bfHint">One shot per line</span>
          </div>
        </div>

        <div className="sheetFoot">
          <button className="primary" onClick={() => onSave(draft)}>
            Save changes
          </button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
