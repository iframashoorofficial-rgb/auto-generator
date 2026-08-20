import type { FormatDef } from "./types";

/**
 * A deliberately different shape from the carousel: three frames, not five,
 * no arrow, no step chain. It exists to keep the app honest — nothing in the
 * renderer or the agent may assume five slides or a comparison structure.
 */
export const proofDrop: FormatDef = {
  id: "proof-drop",
  name: "Proof drop",
  description:
    "Three frames: a claim worth stopping for, the evidence behind it, and what to do next.",
  beats: "claim → evidence → next step",
  width: 1080,
  height: 1920,
  intakeGoals: [
    "One claim the business can make that a sceptical customer would doubt.",
    "The concrete evidence that makes that claim credible — named, checkable things.",
    "What the customer should do immediately after seeing it.",
  ],
  writingRules: [
    "Frame 1 is the claim alone. No setup, no brand name, no hedging.",
    "Frame 2 must cite something real from the proof list. If proof is thin, say less.",
    "Frame 3 is a single instruction, in the imperative.",
    "Never imply a guarantee the business has not actually made.",
  ],
  frames: [
    {
      role: "The claim",
      purpose: "State the boldest true thing. It should sound almost too strong.",
      alt: "A striking, quiet establishing shot",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.52) 26%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.24) 74%, rgba(0,0,0,0.56) 100%)",
      box: { top: 560, left: 60, right: 60, gap: 14 },
      wordmark: true,
      photo: "establish",
      lines: [
        { slot: "claimA", size: 132, weight: 800 },
        { slot: "claimB", size: 132, weight: 800 },
      ],
    },
    {
      role: "The evidence",
      purpose: "Back the claim with something checkable. Specific, unglamorous, true.",
      alt: "The work itself, close up",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.64) 0%, rgba(0,0,0,0.50) 26%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.20) 72%, rgba(0,0,0,0.52) 100%)",
      box: { top: 300, left: 50, right: 50, gap: 16 },
      photo: "repetition",
      lines: [
        { slot: "proofLead", size: 92, weight: 800 },
        { slot: "proofA", size: 68, weight: 700 },
        { slot: "proofB", size: 68, weight: 700 },
      ],
    },
    {
      role: "The next step",
      purpose: "One instruction. Frictionless, obvious, immediate.",
      alt: "Someone reaching for their phone",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.46) 28%, rgba(0,0,0,0.30) 54%, rgba(0,0,0,0.30) 76%, rgba(0,0,0,0.58) 100%)",
      box: { top: 520, left: 50, right: 50, gap: 14 },
      wordmark: true,
      photo: "method",
      lines: [
        { slot: "ctaA", size: 110, weight: 800 },
        { slot: "ctaB", size: 76, weight: 700 },
      ],
    },
  ],
  slots: [
    { key: "claimA", label: "1 · Claim line 1", intent: "First half of the claim.", max: 16 },
    { key: "claimB", label: "1 · Claim line 2", intent: "Second half, where it lands.", max: 16 },
    { key: "proofLead", label: "2 · Lead", intent: "Introduces the evidence.", max: 20 },
    { key: "proofA", label: "2 · Evidence 1", intent: "A checkable fact.", max: 28 },
    { key: "proofB", label: "2 · Evidence 2", intent: "A second checkable fact.", max: 28 },
    { key: "ctaA", label: "3 · Instruction", intent: "The action, imperative.", max: 18 },
    { key: "ctaB", label: "3 · Detail", intent: "Where or how, in a few words.", max: 24 },
  ],
};
