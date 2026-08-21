"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FORMATS, getFormat } from "@/lib/formats";
import { PACKS, getPack, matchPack } from "@/lib/packs";
import { brandProgress, mergeVisual, type BrandProfile } from "@/lib/brand";
import { defaultVisual } from "@/lib/visual-prompt";
import { REMIX_MODES, learnFrom, type RemixMode } from "@/lib/remix";
import { usePersistentState } from "@/lib/store";
import { queueId, type QueueItem } from "@/lib/queue";
import { IntakeChat } from "@/components/IntakeChat";
import { BrandProgress } from "@/components/BrandProgress";
import { BrandPanel } from "@/components/BrandPanel";
import { ContentQueue } from "@/components/ContentQueue";
import { FrameView } from "@/components/FrameView";
import { renderFrame, saveBlob } from "@/lib/render-canvas";
import type { PhotoRole } from "@/lib/packs";

const SCALE = 0.26;

export default function Studio() {
  const { brand, turns, queue, hydrated, setBrand, setTurns, setQueue, reset } =
    usePersistentState();

  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [slots, setSlots] = useState<Record<string, string> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [steer, setSteer] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [packId, setPackId] = useState("auto");
  const [shots, setShots] = useState<Record<number, string>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  /**
   * Generated slide images live in memory only. A single one is ~2MB of
   * base64 and the whole origin gets ~5MB of localStorage, so we persist the
   * recipe (Visual DNA) and regenerate pixels on demand instead.
   */
  const [generated, setGenerated] = useState<Record<number, string>>({});
  const [imaging, setImaging] = useState<Record<number, boolean>>({});

  const [chatOpen, setChatOpen] = useState(false);
  const [chatFailed, setChatFailed] = useState(false);
  const [chatTurns, setChatTurns] = useState(0);

  const format = getFormat(formatId);
  const progress = brandProgress(brand);
  const onboarded = brand.onboarded;

  // Open onboarding on a first visit; a returning brand goes straight in.
  useEffect(() => {
    if (hydrated && !onboarded) setChatOpen(true);
  }, [hydrated, onboarded]);

  // Reaching 100% saves, celebrates briefly, then minimises to the bubble.
  useEffect(() => {
    if (!onboarded || !chatOpen) return;
    const t = setTimeout(() => setChatOpen(false), 1600);
    return () => clearTimeout(t);
  }, [onboarded, chatOpen]);

  useEffect(() => {
    if (!chatOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [chatOpen]);

  // Nobody may be trapped: once the profile is usable, or the interview has
  // broken, or they have answered plenty, they can leave.
  const canLeave = onboarded || chatFailed || progress === 100 || chatTurns >= 8;

  useEffect(() => {
    if (!chatOpen || !canLeave) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, canLeave]);

  const pack = useMemo(() => {
    if (packId !== "auto") return getPack(packId);
    const b = brand.business;
    return matchPack([b.sector, b.offering, b.name, b.audience].join(" "));
  }, [packId, brand]);

  const addIdeas = useCallback(
    (items: QueueItem[]) => setQueue((q) => [...items, ...q]),
    [setQueue],
  );

  async function generate(bump: boolean, remix?: RemixMode) {
    const nextAttempt = bump ? attempt + 1 : 0;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatId,
          brand,
          profile: brand.business,
          attempt: nextAttempt,
          steer: steer.trim(),
          remix,
          previous: remix ? slots : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setSlots(data.slots);
      setAttempt(nextAttempt);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Generate the image for one slide.
   *
   * Earlier slides are passed as references — showing the model the look holds
   * a set together far better than describing it ever does.
   */
  async function makeImage(index: number) {
    setImaging((m) => ({ ...m, [index]: true }));
    setError(null);
    try {
      const references = Object.keys(generated)
        .map(Number)
        .filter((i) => i < index)
        .sort((a, b) => a - b)
        .slice(0, 2)
        .map((i) => generated[i]);

      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          formatId,
          frameIndex: index,
          copy: slots ? Object.values(slots)[index] : undefined,
          references,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Image generation failed.");
        return;
      }
      setGenerated((g) => ({ ...g, [index]: data.dataUrl }));
    } catch {
      setError("Could not reach the image service.");
    } finally {
      setImaging((m) => ({ ...m, [index]: false }));
    }
  }

  async function makeAllImages() {
    // Sequential on purpose: each slide references the ones before it.
    for (let i = 0; i < format.frames.length; i++) {
      if (!generated[i]) await makeImage(i);
    }
  }

  function photoFor(index: number) {
    const frame = format.frames[index];
    return (
      generated[index] ||
      shots[index] ||
      pack.photos[frame.photo as PhotoRole] ||
      pack.photos.establish
    );
  }

  function slug(text: string) {
    return (text || "frames").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function exportFrames(only?: number) {
    if (!slots) return;
    setExporting(true);
    setError(null);
    try {
      const indexes = only === undefined ? format.frames.map((_, i) => i) : [only];
      for (const i of indexes) {
        const blob = await renderFrame({
          format,
          frame: format.frames[i],
          slots,
          photoSrc: photoFor(i),
          wordmark: brand.business.name,
        });
        saveBlob(blob, `${slug(brand.business.name)}-${format.id}-${String(i + 1).padStart(2, "0")}.png`);
        if (indexes.length > 1) await new Promise((r) => setTimeout(r, 350));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  function pickPhoto(index: number, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setShots((s) => ({ ...s, [index]: String(reader.result) }));
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  /** Feedback actions teach the brand record what this user keeps choosing. */
  function react(liked: boolean) {
    if (!slots) return;
    setBrand((b) => ({
      ...b,
      prefs: learnFrom(b.prefs, { liked, format, slots, visual: b.visual }),
      updatedAt: Date.now(),
    }));
    setFeedback(
      liked
        ? "Noted — future carousels will lean this way."
        : "Noted — I'll avoid this shape next time.",
    );
    setTimeout(() => setFeedback(null), 3000);
  }

  function lockVisualStyle() {
    setBrand((b) => ({
      ...b,
      visual: mergeVisual(
        b.visual.aesthetic ? b.visual : defaultVisual(b.business.sector),
        { locked: true },
      ),
      prefs: { ...b.prefs, visualStyle: b.visual.aesthetic || "house style" },
      updatedAt: Date.now(),
    }));
    setFeedback("Visual style locked. Every future carousel starts from this look.");
    setTimeout(() => setFeedback(null), 3500);
  }

  function askForIdeas() {
    setChatOpen(true);
    setTurns((t) => [
      ...t,
      {
        role: "assistant",
        content:
          "Ask me for this week's carousel ideas and I'll add them to your queue.",
      },
    ]);
  }

  function useIdea(item: QueueItem) {
    setFormatId(item.formatId || formatId);
    setSteer(item.title);
    setSlots(null);
    setGenerated({});
    setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, status: "draft" } : x)));
  }

  function saveCurrentToQueue() {
    if (!slots) return;
    const title = Object.values(slots).find(Boolean) ?? format.name;
    setQueue((q) => [
      {
        id: queueId(title, q.length),
        title,
        angle: `${format.name} · ${format.beats}`,
        formatId,
        status: "draft",
        createdAt: Date.now(),
      },
      ...q,
    ]);
    setFeedback("Saved to the queue.");
    setTimeout(() => setFeedback(null), 2500);
  }

  const locked = chatOpen && !canLeave;

  // No hydration guard around the page itself: the server and the first client
  // render both use EMPTY_BRAND, and the store is read in an effect afterwards.
  // Only genuinely post-hydration chrome (the bubble) waits, to avoid a flash.
  return (
    <>
      <main className="shell" inert={locked ? true : undefined}>
        <header className="top">
          <p className="eyebrow">Format studio</p>
          <h1>
            {brand.business.name
              ? `${brand.business.name} — every format, one brand.`
              : "Tell it about the brand. Get the assets."}
          </h1>
          <p className="lede">
            The assistant learns the brand once. Every format, every carousel and every
            image afterwards draws on that same memory.
          </p>
        </header>

        <div className="cols">
          <section className="side">
            <div className="panel">
              <h2>Format</h2>
              <div className="formatList">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="formatBtn"
                    aria-pressed={f.id === formatId}
                    onClick={() => {
                      setFormatId(f.id);
                      setSlots(null);
                      setAttempt(0);
                      setGenerated({});
                    }}
                  >
                    <span className="fname">{f.name}</span>
                    <span className="fdesc">{f.description}</span>
                    <span className="fbeat">
                      {f.beats} · {f.frames.length} frames
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2>Onboarding</h2>
              <BrandProgress brand={brand} />
              <div className="sideRow">
                <button className="mini" onClick={() => setChatOpen(true)}>
                  Open Brand Assistant
                </button>
                <button
                  className="mini"
                  onClick={() => {
                    if (confirm("Forget this brand and start over?")) reset();
                  }}
                >
                  Reset brand
                </button>
              </div>
            </div>

            <BrandPanel brand={brand} onChange={setBrand} />

            <div className="panel">
              <h2>Photos</h2>
              <label className="fieldLabel" htmlFor="pack">
                Fallback photo set
              </label>
              <select id="pack" value={packId} onChange={(e) => setPackId(e.target.value)}>
                <option value="auto">Match the brand automatically</option>
                {PACKS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="hint">
                Used only until a slide has a generated image. Generated images follow the
                brand&apos;s Visual DNA, which is what keeps a set consistent.
              </p>
            </div>

            <ContentQueue
              queue={queue}
              onQueue={setQueue}
              onUseIdea={useIdea}
              onAskForIdeas={askForIdeas}
            />
          </section>

          <section className="main">
            <div className="panel">
              <h2>Write it</h2>
              <div className="genRow">
                <input
                  type="text"
                  value={steer}
                  onChange={(e) => setSteer(e.target.value)}
                  placeholder="Optional steer — e.g. lead with speed, keep it dry"
                />
                <button className="primary" onClick={() => void generate(false)} disabled={busy}>
                  {busy ? "Writing…" : "Generate"}
                </button>
                <button onClick={() => void generate(true)} disabled={busy || !slots}>
                  Regenerate
                </button>
              </div>
              {progress < 100 && (
                <p className="hint">
                  The brand profile is {progress}% complete — the copy is only as good as
                  what the assistant knows.
                </p>
              )}
              {error && <p className="error">{error}</p>}
              {feedback && <p className="okNote">{feedback}</p>}
            </div>

            {slots && (
              <>
                <div className="panel">
                  <h2>This carousel</h2>
                  <div className="actRow">
                    <button className="mini" onClick={() => react(true)}>👍 More like this</button>
                    <button className="mini" onClick={() => react(false)}>👎 Less like this</button>
                    <button className="mini" onClick={saveCurrentToQueue}>Save to queue</button>
                    <button className="mini" onClick={lockVisualStyle}>
                      {brand.visual.locked ? "✓ Visual style locked" : "Use this visual style going forward"}
                    </button>
                  </div>
                  <div className="actRow remixRow">
                    <span className="actLabel">Remix:</span>
                    {REMIX_MODES.map((m) => (
                      <button
                        key={m.id}
                        className="mini"
                        title={m.hint}
                        disabled={busy}
                        onClick={() => void generate(true, m.id)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="exportBar">
                  <button className="primary" onClick={() => void exportFrames()} disabled={exporting}>
                    {exporting ? "Rendering…" : `Download all ${format.frames.length} frames`}
                  </button>
                  <button onClick={() => void makeAllImages()} disabled={Object.values(imaging).some(Boolean)}>
                    Generate all images
                  </button>
                  <span className="hint">
                    {format.width} × {format.height} PNG. Generated images cost roughly
                    4¢ each.
                  </span>
                </div>

                <div className="stripWrap">
                  <div className="strip">
                    {format.frames.map((frame, i) => (
                      <div className="cell" key={`${format.id}-${i}`} style={{ width: format.width * SCALE }}>
                        <FrameView
                          format={format}
                          frame={frame}
                          slots={slots}
                          pack={pack}
                          override={generated[i] || shots[i]}
                          wordmark={brand.business.name}
                          scale={SCALE}
                        />
                        <div className="cap">
                          <span className="no">{String(i + 1).padStart(2, "0")}</span>
                          <span className="role">{frame.role}</span>
                          <div className="shotRow">
                            <button
                              className="mini"
                              onClick={() => void makeImage(i)}
                              disabled={imaging[i]}
                            >
                              {imaging[i] ? "Painting…" : generated[i] ? "Regenerate image" : "Generate image"}
                            </button>
                            <button className="mini" onClick={() => fileRefs.current[i]?.click()}>
                              Upload
                            </button>
                            <button className="mini" onClick={() => void exportFrames(i)} disabled={exporting}>
                              PNG
                            </button>
                            {(shots[i] || generated[i]) && (
                              <button
                                className="mini"
                                onClick={() => {
                                  setShots((s) => {
                                    const n = { ...s };
                                    delete n[i];
                                    return n;
                                  });
                                  setGenerated((g) => {
                                    const n = { ...g };
                                    delete n[i];
                                    return n;
                                  });
                                }}
                              >
                                Reset
                              </button>
                            )}
                            <input
                              ref={(node) => {
                                fileRefs.current[i] = node;
                              }}
                              type="file"
                              accept="image/*"
                              className="visuallyHidden"
                              onChange={(e) => pickPhoto(i, e.target.files?.[0])}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel">
                  <h2>Edit the copy</h2>
                  <div className="editGrid">
                    {format.slots.map((slot) => {
                      const value = slots[slot.key] ?? "";
                      const over = value.length > slot.max;
                      return (
                        <div className="slot" key={slot.key}>
                          <label className="slabel" htmlFor={`slot-${slot.key}`}>
                            {slot.label}
                          </label>
                          <textarea
                            id={`slot-${slot.key}`}
                            value={value}
                            rows={2}
                            onChange={(e) =>
                              setSlots((s) => ({ ...(s ?? {}), [slot.key]: e.target.value }))
                            }
                          />
                          <span className={`count${over ? " over" : ""}`}>
                            {value.length} / {slot.max} chars
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Kept mounted while minimised so the conversation survives closing. */}
      <div
        className={`chatOverlay${chatOpen ? "" : " isMinimised"}`}
        inert={chatOpen ? undefined : true}
        onMouseDown={(e) => {
          if (canLeave && e.target === e.currentTarget) setChatOpen(false);
        }}
      >
        <div className="panel chatModal" role="dialog" aria-modal="true" aria-labelledby="chatModalTitle">
          <div className="chatModalHead">
            <h2 id="chatModalTitle">{onboarded ? "Brand Assistant" : "Let's meet your brand"}</h2>
            {canLeave && (
              <button className="mini" onClick={() => setChatOpen(false)} aria-label="Minimise">
                Minimise
              </button>
            )}
          </div>

          <BrandProgress brand={brand} compact />

          <p className="hint chatModalNote">
            {onboarded
              ? "I remember this brand. Tell me what's changed — \"make our tone more playful\", \"we're targeting founders now\" — and I'll update the profile."
              : "A few questions, then I'll read your website so you don't have to repeat what's already public."}
          </p>

          <IntakeChat
            formatId={formatId}
            brand={brand}
            turns={turns}
            onTurns={setTurns}
            onBrand={setBrand}
            onQueueIdeas={addIdeas}
            onFailure={setChatFailed}
            onUserTurns={setChatTurns}
            active={chatOpen}
          />

          {canLeave && !onboarded && (
            <button className="mini chatSkip" onClick={() => setChatOpen(false)}>
              {chatFailed ? "Skip for now and browse the studio" : "Continue to the studio"}
            </button>
          )}
        </div>
      </div>

      {hydrated && !chatOpen && (
        <button
          className="chatBubble"
          onClick={() => setChatOpen(true)}
          aria-label="Open the Brand Assistant"
          title="Brand Assistant"
        >
          <span aria-hidden="true">💬</span>
          {progress < 100 && <span className="bubbleDot" aria-hidden="true" />}
        </button>
      )}
    </>
  );
}
