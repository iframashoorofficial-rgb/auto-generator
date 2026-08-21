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

import type { ContentIdea } from "./ideas";
import { persistableMedia } from "./media";

export interface DeckSession {
  /** Stable across refreshes; a new one means a genuinely new sitting. */
  id: string;
  /** The pool, in insertion order. Ranking happens at read time. */
  ideas: ContentIdea[];
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
    ideas: deck.ideas.map((idea) => {
      const media = persistableMedia(idea.media);
      return media ? { ...idea, media } : { ...idea, media: undefined };
    }),
  };
}

/** Guard against a hand-edited or older stored blob. */
export function isDeckSession(value: unknown): value is DeckSession {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<DeckSession>;
  return typeof d.id === "string" && Array.isArray(d.ideas);
}
