"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentAsset } from "@/lib/assets";
import { IdeaCard } from "./IdeaCard";

/**
 * The swipe deck.
 *
 * Pointer Events rather than a gesture library: one dependency-free handler
 * covers mouse, touch and pen, and `setPointerCapture` means a fast flick that
 * leaves the card still delivers its own pointerup.
 *
 * Only the top two cards are mounted. The one underneath exists so the next
 * idea is already there as the top card leaves.
 */

const SWIPE_THRESHOLD = 110;
/** A fast flick counts even if it never travels far. */
const VELOCITY_THRESHOLD = 0.45;
const EXIT_MS = 320;

export type SwipeDir = "like" | "pass";

interface DragState {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
}

export function SwipeDeck({
  ideas,
  onDecide,
  onEdit,
  onGenerateVisual,
  generating,
  busy,
  onMore,
}: {
  ideas: ContentAsset[];
  onDecide: (idea: ContentAsset, dir: SwipeDir) => void;
  onEdit: (idea: ContentAsset) => void;
  onGenerateVisual: (idea: ContentAsset) => void;
  generating: Record<string, boolean>;
  busy?: boolean;
  onMore: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [exiting, setExiting] = useState<SwipeDir | null>(null);
  const drag = useRef<DragState | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const top = ideas[0];
  const next = ideas[1];

  /** Animate the card off-screen, then hand the decision up. */
  const commit = useCallback(
    (dir: SwipeDir) => {
      if (!top || exiting) return;
      setExiting(dir);
      window.setTimeout(() => {
        setExiting(null);
        setDx(0);
        setDy(0);
        onDecide(top, dir);
      }, EXIT_MS);
    },
    [top, exiting, onDecide],
  );

  // Keyboard parity: the deck must be usable without a pointer at all.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "ArrowRight") commit("like");
      if (e.key === "ArrowLeft") commit("pass");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  function onPointerDown(e: React.PointerEvent) {
    if (exiting || !top) return;
    // Let the editor and buttons inside the card work normally.
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
    };
    cardRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setDx(e.clientX - d.startX);
    // Vertical follow is damped — this is a horizontal gesture.
    setDy((e.clientY - d.startY) * 0.25);
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    cardRef.current?.releasePointerCapture?.(e.pointerId);

    const dist = e.clientX - d.startX;
    const velocity = Math.abs(dist) / Math.max(1, performance.now() - d.startTime);

    if (Math.abs(dist) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      commit(dist > 0 ? "like" : "pass");
    } else {
      // Below threshold: spring back.
      setDx(0);
      setDy(0);
    }
  }

  const dragging = drag.current !== null;
  // Progress toward a decision, 0..1 — drives the overlay opacity.
  const intent = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD);
  const rotation = dx / 18;

  const style: React.CSSProperties = exiting
    ? {
        transform: `translate(${exiting === "like" ? 620 : -620}px, ${dy}px) rotate(${
          exiting === "like" ? 26 : -26
        }deg)`,
        opacity: 0,
        transition: `transform ${EXIT_MS}ms cubic-bezier(.22,.61,.36,1), opacity ${EXIT_MS}ms ease`,
      }
    : {
        transform: `translate(${dx}px, ${dy}px) rotate(${rotation}deg)`,
        transition: dragging ? "none" : "transform 340ms cubic-bezier(.34,1.4,.64,1)",
      };

  if (!top) {
    return (
      <div className="deckEmpty">
        <p className="deckEmptyTitle">That&apos;s the batch.</p>
        <p className="hint">
          Every swipe sharpened the profile. The next set will reflect it.
        </p>
        <button className="primary" onClick={onMore} disabled={busy}>
          {busy ? "Thinking…" : "Get more ideas"}
        </button>
      </div>
    );
  }

  return (
    <div className="deck">
      <div className="deckStage">
        {next && (
          <div className="deckCard isBehind" aria-hidden="true">
            <IdeaCard idea={next} onEdit={() => {}} onGenerateVisual={() => {}} inert />
          </div>
        )}

        <div
          ref={cardRef}
          className={`deckCard isTop${dragging ? " isDragging" : ""}`}
          style={style}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <IdeaCard
            idea={top}
            onEdit={() => onEdit(top)}
            onGenerateVisual={() => onGenerateVisual(top)}
            generating={generating[top.id]}
          />

          <div className="stampWrap" aria-hidden="true">
            <span
              className="stamp stampLike"
              style={{ opacity: dx > 0 ? intent : 0, transform: `scale(${0.85 + intent * 0.2})` }}
            >
              More like this
            </span>
            <span
              className="stamp stampPass"
              style={{ opacity: dx < 0 ? intent : 0, transform: `scale(${0.85 + intent * 0.2})` }}
            >
              Less like this
            </span>
          </div>
        </div>
      </div>

      <div className="deckControls">
        <button
          className="circleBtn pass"
          onClick={() => commit("pass")}
          disabled={!!exiting}
          aria-label="Less like this"
          title="Less like this (or swipe left)"
        >
          ✕
        </button>
        <button
          className="pillBtn"
          onClick={() => onEdit(top)}
          disabled={!!exiting}
          aria-label="Edit this idea"
        >
          Edit
        </button>
        <button
          className="circleBtn like"
          onClick={() => commit("like")}
          disabled={!!exiting}
          aria-label="More like this"
          title="More like this (or swipe right)"
        >
          ✓
        </button>
      </div>

      <p className="deckHint">
        Swipe or use ← →. This teaches the assistant your taste; it never publishes.
      </p>
    </div>
  );
}
