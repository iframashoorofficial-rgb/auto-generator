"use client";

import { useState } from "react";
import { angleLabel, assetLabel, type ContentAsset } from "@/lib/assets";
import { AssetView } from "./AssetView";

/**
 * One finished asset, as a card.
 *
 * The card shows the thing itself — the composed slides, the reel beats, the
 * meme — with the caption and reasoning tucked underneath. Everything
 * secondary stays behind a disclosure so the media stays the card.
 */
export function IdeaCard({
  idea,
  onEdit,
  onGenerateVisual,
  generating,
  inert = false,
}: {
  idea: ContentAsset;
  onEdit: () => void;
  onGenerateVisual: () => void;
  generating?: boolean;
  inert?: boolean;
}) {
  const [why, setWhy] = useState(false);
  const [showCaption, setShowCaption] = useState(false);

  const generated = idea.slides.some((s) => s.media?.source === "generated");
  const hasVideo = idea.slides.some((s) => s.media?.kind === "video");

  return (
    <article className="ideaCard">
      <div className="ideaMedia">
        <AssetView asset={idea} active={!inert} />

        <div className="ideaTags">
          <span className="tag tagFormat">{assetLabel(idea.kind)}</span>
          <span className="tag">{angleLabel(idea.angle)}</span>
          {idea.platform && <span className="tag">{idea.platform}</span>}
          {generated && <span className="tag tagOwn">Brand visual</span>}
          {hasVideo && <span className="tag tagOwn">Video</span>}
        </div>
      </div>

      <div className="ideaFoot">
        <button
          className="linkBtn"
          onClick={() => setShowCaption((c) => !c)}
          aria-expanded={showCaption}
          disabled={inert}
        >
          Caption
        </button>
        <button
          className="linkBtn"
          onClick={() => setWhy((w) => !w)}
          aria-expanded={why}
          disabled={inert}
        >
          {why ? "Hide reasoning" : "Why this content?"}
        </button>
        <button className="linkBtn" onClick={onEdit} disabled={inert}>
          Edit
        </button>
        <button
          className="linkBtn"
          onClick={onGenerateVisual}
          disabled={inert || generating}
          title="Generates a branded image from your Visual DNA (~4¢)"
        >
          {generating ? "Painting…" : generated ? "New visual" : "Generate visual"}
        </button>
      </div>

      {showCaption && (
        <div className="whyPanel">
          <p className="whyTitle">Caption</p>
          <p className="captionText">{idea.caption}</p>
          {idea.hashtags.length > 0 && (
            <p className="captionTags">{idea.hashtags.join(" ")}</p>
          )}
          {idea.audioHint && <p className="hint">Sound: {idea.audioHint}</p>}
        </div>
      )}

      {why && (
        <div className="whyPanel">
          <p className="whyTitle">Why this was suggested</p>
          {idea.why.length ? (
            <ul className="whyList">
              {idea.why.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="hint">Built from your brand profile.</p>
          )}
        </div>
      )}
    </article>
  );
}
