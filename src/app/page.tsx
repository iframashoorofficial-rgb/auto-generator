"use client";

import { useMemo, useRef, useState } from "react";
import { FORMATS, getFormat } from "@/lib/formats";
import { PACKS, getPack, matchPack } from "@/lib/packs";
import { EMPTY_PROFILE, completeness, type BusinessProfile } from "@/lib/profile";
import { IntakeChat } from "@/components/IntakeChat";
import { FrameView } from "@/components/FrameView";

const SCALE = 0.26;

export default function Studio() {
  const [formatId, setFormatId] = useState(FORMATS[0].id);
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [ready, setReady] = useState(false);

  const [slots, setSlots] = useState<Record<string, string> | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [steer, setSteer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [packId, setPackId] = useState("auto");
  const [shots, setShots] = useState<Record<number, string>>({});
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const format = getFormat(formatId);

  const pack = useMemo(() => {
    if (packId !== "auto") return getPack(packId);
    const hay = [profile.sector, profile.offering, profile.name, profile.audience].join(" ");
    return matchPack(hay);
  }, [packId, profile]);

  async function generate(bump: boolean) {
    const nextAttempt = bump ? attempt + 1 : 0;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formatId, profile, attempt: nextAttempt, steer: steer.trim() }),
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

  const pct = completeness(profile);

  return (
    <main className="shell">
      <header className="top">
        <p className="eyebrow">Format studio</p>
        <h1>Tell it about the business. Get the assets.</h1>
        <p className="lede">
          An interview builds one profile of the business. Every format draws on that same
          profile, so adding a new format never means asking the same questions again.
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
            <h2>What we know</h2>
            <div className="meter" role="img" aria-label={`Profile ${pct}% complete`}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="meterNote">{pct}% of the essentials captured</p>
            <dl className="facts">
              <Fact label="Business" value={profile.name} />
              <Fact label="Sells" value={profile.offering} />
              <Fact label="Audience" value={profile.audience} />
              <Fact label="Problem" value={profile.problem} />
              <Fact label="Instead they" value={profile.alternative} />
              <Fact label="Edge" value={profile.edge} />
              <Fact label="Proof" value={profile.proof.join("; ")} />
              <Fact label="Voice" value={profile.voice} />
            </dl>
          </div>

          <div className="panel">
            <h2>Photos</h2>
            <label className="fieldLabel" htmlFor="pack">
              Photo set
            </label>
            <select id="pack" value={packId} onChange={(e) => setPackId(e.target.value)}>
              <option value="auto">Match the business automatically</option>
              {PACKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="hint">
              {packId === "auto" ? `Matched to ${pack.name}.` : `Using ${pack.name}.`} Swap any
              single photo under the preview.
            </p>
          </div>
        </section>

        <section className="main">
          <div className="panel">
            <h2>Interview</h2>
            <IntakeChat
              formatId={formatId}
              profile={profile}
              onProfile={setProfile}
              onReady={setReady}
            />
          </div>

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
            {!ready && pct < 100 && (
              <p className="hint">
                You can generate now, but the copy is only as good as the profile — the interview
                is still missing things.
              </p>
            )}
            {error && <p className="error">{error}</p>}
          </div>

          {slots && (
            <>
              <div className="stripWrap">
                <div className="strip">
                  {format.frames.map((frame, i) => (
                    <div className="cell" key={`${format.id}-${i}`} style={{ width: format.width * SCALE }}>
                      <FrameView
                        format={format}
                        frame={frame}
                        slots={slots}
                        pack={pack}
                        override={shots[i]}
                        wordmark={profile.name}
                        scale={SCALE}
                      />
                      <div className="cap">
                        <span className="no">{String(i + 1).padStart(2, "0")}</span>
                        <span className="role">{frame.role}</span>
                        <div className="shotRow">
                          <button
                            className="mini"
                            onClick={() => fileRefs.current[i]?.click()}
                          >
                            {shots[i] ? "Change photo" : "Replace photo"}
                          </button>
                          {shots[i] && (
                            <button
                              className="mini"
                              onClick={() =>
                                setShots((s) => {
                                  const n = { ...s };
                                  delete n[i];
                                  return n;
                                })
                              }
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
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className={value ? "" : "unknown"}>{value || "—"}</dd>
    </>
  );
}
