/**
 * Session persistence.
 *
 * Everything the assistant remembers lives in localStorage under one versioned
 * key, so a schema change is a single bump rather than a migration per field.
 *
 * Deliberately not storing generated images: a single slide is ~2MB of base64
 * and the whole origin gets ~5MB. We persist the *recipe* — Visual DNA, prompt
 * and reference — and regenerate pixels on demand.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_BRAND, mergeBrand, type BrandProfile } from "./brand";
import type { ChatTurn } from "./chat-types";
import type { QueueItem } from "./queue";

const KEY = "format-studio.v1";

export interface StoredState {
  version: number;
  brand: BrandProfile;
  /** The onboarding / assistant conversation, so it survives a refresh. */
  turns: ChatTurn[];
  queue: QueueItem[];
}

const EMPTY_STATE: StoredState = {
  version: 1,
  brand: EMPTY_BRAND,
  turns: [],
  queue: [],
};

function read(): StoredState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    if (parsed.version !== 1) return EMPTY_STATE;
    return {
      version: 1,
      // Merge onto EMPTY_BRAND so fields added in a later release exist.
      brand: mergeBrand(EMPTY_BRAND, parsed.brand),
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      queue: Array.isArray(parsed.queue) ? parsed.queue : [],
    };
  } catch {
    // Corrupt or unreadable storage should never block the app.
    return EMPTY_STATE;
  }
}

function write(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private mode — the app still works, just forgets.
  }
}

export function clearStore() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Loads once on mount rather than during render, so server and first client
 * render agree and React does not complain about hydration.
 */
export function usePersistentState() {
  const [state, setState] = useState<StoredState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setState(read());
    setHydrated(true);
  }, []);

  // Debounced so typing through an interview is not a write per keystroke.
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => write(state), 250);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  const setBrand = useCallback((update: (b: BrandProfile) => BrandProfile) => {
    setState((s) => ({ ...s, brand: update(s.brand) }));
  }, []);

  const setTurns = useCallback((update: (t: ChatTurn[]) => ChatTurn[]) => {
    setState((s) => ({ ...s, turns: update(s.turns) }));
  }, []);

  const setQueue = useCallback((update: (q: QueueItem[]) => QueueItem[]) => {
    setState((s) => ({ ...s, queue: update(s.queue) }));
  }, []);

  const reset = useCallback(() => {
    clearStore();
    setState(EMPTY_STATE);
  }, []);

  return { ...state, hydrated, setBrand, setTurns, setQueue, reset };
}
