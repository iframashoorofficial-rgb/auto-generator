"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeBrand, type BrandProfile } from "@/lib/brand";
import type { ChatTurn } from "@/lib/chat-types";
import type { QueueItem } from "@/lib/queue";
import { queueId } from "@/lib/queue";

export type { ChatTurn };

/** Fixed by product decision — the brand name is always question one. */
export const OPENER = "What's the name of your brand?";

interface IdeaFromAgent {
  title?: string;
  angle?: string;
  formatId?: string;
}

export function IntakeChat({
  formatId,
  brand,
  turns,
  onTurns,
  onBrand,
  onQueueIdeas,
  onFailure,
  onUserTurns,
  active = true,
}: {
  formatId: string;
  brand: BrandProfile;
  turns: ChatTurn[];
  onTurns: (update: (t: ChatTurn[]) => ChatTurn[]) => void;
  onBrand: (update: (b: BrandProfile) => BrandProfile) => void;
  onQueueIdeas?: (items: QueueItem[]) => void;
  onFailure?: (failed: boolean) => void;
  onUserTurns?: (count: number) => void;
  active?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Seed the opener once, so a returning visitor resumes mid-conversation
  // instead of being greeted from scratch.
  useEffect(() => {
    if (!turns.length) onTurns(() => [{ role: "assistant", content: OPENER }]);
  }, [turns.length, onTurns]);

  useEffect(() => {
    if (!active) return;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, status, active]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  useEffect(() => {
    onUserTurns?.(turns.filter((t) => t.role === "user").length);
  }, [turns, onUserTurns]);

  /**
   * Read the brand's website and fold what it says into the record.
   * Returns the enriched brand so the caller can keep going without waiting
   * for React state to settle.
   */
  const research = useCallback(
    async (url: string, current: BrandProfile): Promise<BrandProfile> => {
      setStatus(`Reading ${url.replace(/^https?:\/\//, "").replace(/\/$/, "")}…`);
      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandName: current.business.name, url }),
        });
        const data = await res.json();

        if (!res.ok) {
          onTurns((t) => [
            ...t,
            {
              role: "assistant",
              content: `${data.error} Tell me in your own words instead — what does the brand do?`,
            },
          ]);
          return current;
        }

        const enriched = mergeBrand(current, {
          website: data.url,
          business: data.business,
          positioning: data.positioning,
          contentGoals: data.contentGoals,
          platforms: data.platforms,
          visual: data.visual,
          researched: true,
        });
        onBrand(() => enriched);

        // Never treat research as final — ask before trusting it.
        const unknowns: string[] = Array.isArray(data.stillUnknown) ? data.stillUnknown : [];
        onTurns((t) => [
          ...t,
          {
            role: "assistant",
            content: [
              `Here's what I found${data.detectedName ? ` for ${data.detectedName}` : ""}:`,
              "",
              data.summary,
              "",
              data.confidence === "low"
                ? "I'm not confident this is right — have I got the correct brand?"
                : "Is that right? Correct anything that's off and I'll update it.",
              unknowns.length
                ? `\nThe site didn't tell me: ${unknowns.slice(0, 4).join(", ")}.`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ]);
        return enriched;
      } catch {
        onTurns((t) => [
          ...t,
          {
            role: "assistant",
            content: "I couldn't reach that site. Tell me about the brand instead.",
          },
        ]);
        return current;
      } finally {
        setStatus(null);
      }
    },
    [onBrand, onTurns],
  );

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;

    const next: ChatTurn[] = [...turns, { role: "user", content: text }];
    onTurns(() => next);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, brand, formatId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "The interview stalled. Try again.");
        // Give the answer back rather than making them retype it.
        setDraft(text);
        onTurns((t) => t.filter((_, i) => i !== t.length - 1));
        onFailure?.(true);
        return;
      }

      let working: BrandProfile = data.brand ?? brand;
      onBrand(() => working);
      onTurns((t) => [...t, { role: "assistant", content: data.reply }]);

      // The agent can ask for a website read before continuing.
      if (data.researchUrl) working = await research(data.researchUrl, working);

      if (Array.isArray(data.queueIdeas) && data.queueIdeas.length && onQueueIdeas) {
        onQueueIdeas(
          (data.queueIdeas as IdeaFromAgent[])
            .filter((i) => i?.title)
            .map((i, n) => ({
              id: queueId(String(i.title), n),
              title: String(i.title),
              angle: String(i.angle ?? ""),
              formatId: String(i.formatId ?? formatId),
              status: "idea" as const,
              createdAt: Date.now(),
            })),
        );
      }

      if (data.ready && !working.onboarded) {
        onBrand((b) => ({ ...b, onboarded: true, confirmed: true, updatedAt: Date.now() }));
      }

      onFailure?.(false);
    } catch {
      setError("Could not reach the server.");
      setDraft(text);
      onTurns((t) => t.filter((_, i) => i !== t.length - 1));
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
        {busy && !status && <div className="bubble assistant thinking">thinking…</div>}
        {status && <div className="bubble assistant thinking">{status}</div>}
      </div>

      {error && (
        <p className="error">
          {error} <button className="mini" onClick={() => void send()}>Retry</button>
        </p>
      )}

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
