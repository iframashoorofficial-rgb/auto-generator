/**
 * The Discover session.
 *
 * A refresh used to throw away the deck and pay for a brand new batch. It
 * persists now — everything except image bytes. Generated images are inline
 * base64 (~2MB each) and must never reach localStorage, so `sanitiseDeck`
 * strips them on the way out; a restored card falls back to its stock preview
 * and can be regenerated on request.
 *
 * There is no database and no authenticated user in this app, so the session
 * is per-device. The shape below is deliberately the same one a server-side
 * `deck_sessions` row would hold, so moving it later is a transport change
 * rather than a redesign.
 */

import { isContentAsset, type ContentAsset } from "./assets";
import { persistableMedia } from "./media";

export interface DeckSession {
  /** Stable across refreshes; a new one means a genuinely new sitting. */
  id: string;
  /** The pool, in insertion order. Ranking happens at read time. */
  ideas: ContentAsset[];
  /** How many cards have been decided in this session. */
  position: number;
  createdAt: number;
  updatedAt: number;
}

export function newDeck(id: string, now: number): DeckSession {
  return { id, ideas: [], position: 0, createdAt: now, updatedAt: now };
}

/**
 * Remove anything that cannot or should not be stored.
 *
 * Only inline media is dropped — a real URL, including a future video URL,
 * survives untouched.
 */
export function sanitiseDeck(deck: DeckSession): DeckSession {
  return {
    ...deck,
    ideas: deck.ideas.map((asset) => ({
      ...asset,
      // Media now lives per slide, so every one is checked individually.
      slides: asset.slides.map((s) => ({ ...s, media: persistableMedia(s.media) })),
      meme: asset.meme
        ? { ...asset.meme, reaction: persistableMedia(asset.meme.reaction) }
        : undefined,
    })),
  };
}

/** Guard against a hand-edited or older stored blob. */
export function isDeckSession(value: unknown): value is DeckSession {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<DeckSession>;
  return typeof d.id === "string" && Array.isArray(d.ideas);
}

/**
 * Load a stored deck safely.
 *
 * Cards saved by an older release have a different shape and would throw
 * during render, so they are discarded here. The session itself survives.
 */
export function normaliseDeck(value: unknown, fallbackId: string, now: number): DeckSession {
  if (!isDeckSession(value)) return newDeck(fallbackId, now);
  const ideas = value.ideas.filter(isContentAsset);
  return {
    id: value.id,
    ideas,
    position: Number(value.position) || 0,
    createdAt: Number(value.createdAt) || now,
    updatedAt: Number(value.updatedAt) || now,
  };
}
