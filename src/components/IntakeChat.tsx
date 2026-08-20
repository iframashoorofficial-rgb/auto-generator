"use client";

import { useEffect, useRef, useState } from "react";
import type { BusinessProfile } from "@/lib/profile";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const OPENER =
  "What's the business called, and what does it actually do? Plain words are fine.";

export function IntakeChat({
  formatId,
  profile,
  onProfile,
  onReady,
  onFailure,
  onUserTurns,
  active = true,
}: {
  formatId: string;
  profile: BusinessProfile;
  onProfile: (p: BusinessProfile) => void;
  onReady: (ready: boolean) => void;
  /** Lets the host offer a way out when the interview cannot proceed. */
  onFailure?: (failed: boolean) => void;
  /** How many times the visitor has answered — used as a backstop way out. */
  onUserTurns?: (count: number) => void;
  /** False while the chat is minimised — suppresses autofocus and scrolling. */
  active?: boolean;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([
    { role: "assistant", content: OPENER },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!active) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, active]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  useEffect(() => {
    onUserTurns?.(turns.filter((t) => t.role === "user").length);
  }, [turns, onUserTurns]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;

    const next = [...turns, { role: "user" as const, content: text }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, profile, formatId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "The interview stalled. Try again.");
        onFailure?.(true);
        return;
      }

      setTurns([...next, { role: "assistant", content: data.reply }]);
      if (data.profile) onProfile(data.profile);
      onReady(Boolean(data.ready));
      onFailure?.(false);
    } catch {
      setError("Could not reach the server.");
      onFailure?.(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="chat">
      <div className="chatLog" ref={logRef}>
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            {t.content}
          </div>
        ))}
        {busy && <div className="bubble assistant thinking">thinking…</div>}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="chatInput">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Answer here — Enter to send, Shift+Enter for a new line"
          rows={2}
          disabled={busy}
        />
        <button className="primary" onClick={() => void send()} disabled={busy || !draft.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
