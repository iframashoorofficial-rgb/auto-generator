"use client";

import { useState } from "react";
import { getContentFormat, type ContentIdea } from "@/lib/ideas";
import { matchPack } from "@/lib/packs";

/**
 * One idea, as a card.
 *
 * The visual is the card — text sits over the lower third rather than beside
 * it, so this reads as social media rather than a dashboard row. Everything
 * secondary (scenes, CTA, the reasoning) stays behind "Why this?" until asked
 * for.
 */
export function IdeaCard({
  idea,
  onEdit,
  onGenerateVisual,
  generating,
  inert = false,
}: {
  idea: ContentIdea;
  onEdit: () => void;
  onGenerateVisual: () => void;
  generating?: boolean;
  inert?: boolean;
}) {
  const [why, setWhy] = useState(false);
  const fmt = getContentFormat(idea.formatType);

  // Free preview until the user asks for a generated visual: stock photography
  // keeps the card visual without spending a few cents per idea in a feed.
  const pack = matchPack(`${idea.topic} ${idea.concept} ${idea.audience}`);
  const preview = idea.image || pack.photos[fmt.photo] || pack.photos.establish;

  return (
    <article className="ideaCard">
      <div className="ideaMedia">
        {/* Decorative: the hook beneath carries the meaning. */}
        <img src={preview} alt="" draggable={false} />
        <div className="ideaScrim" />

        <div className="ideaTags">
          <span className="tag tagFormat">{fmt.short}</span>
          {idea.platform && <span className="tag">{idea.platform}</span>}
          {idea.image && <span className="tag tagOwn">Brand visual</span>}
        </div>

        <div className="ideaCopy">
          <h3 className="ideaHook">{idea.hook}</h3>
          {idea.concept && <p className="ideaConcept">{idea.concept}</p>}
        </div>
      </div>

      <div className="ideaFoot">
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
          {generating ? "Painting…" : idea.image ? "New visual" : "Generate visual"}
        </button>
      </div>

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
            <p className="hint">
              Built from your brand profile — no specific reasons were recorded for this one.
            </p>
          )}

          <dl className="whyMeta">
            {idea.audience && <WhyRow label="Audience" value={idea.audience} />}
            {idea.tone && <WhyRow label="Tone" value={idea.tone} />}
            {idea.cta && <WhyRow label="Call to action" value={idea.cta} />}
            {idea.visualDirection && <WhyRow label="Visual" value={idea.visualDirection} />}
            {idea.scenes.length > 0 && (
              <WhyRow label="Scenes" value={idea.scenes.join(" → ")} />
            )}
          </dl>
        </div>
      )}
    </article>
  );
}

function WhyRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
