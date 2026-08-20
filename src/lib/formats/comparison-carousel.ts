import type { FormatDef } from "./types";

/**
 * The format ported from the original carousel: name the alternative, show its
 * friction, offer the simpler route, land the result, end on a question.
 */
export const comparisonCarousel: FormatDef = {
  id: "comparison-carousel",
  name: "Comparison carousel",
  description:
    "Names what the customer uses today, walks through its friction, then shows the shorter path.",
  beats: "alternative → friction → method → result → question",
  width: 1080,
  height: 1920,
  intakeGoals: [
    "What the customer uses today instead — a named rival, or the manual routine.",
    "The specific steps that alternative forces on them, in order.",
    "What the business replaces those steps with, concretely enough to picture.",
    "One result the customer actually gets, stated without invented numbers.",
  ],
  writingRules: [
    "Slide 1 names the alternative on its own line, then states the step it removes.",
    "Slide 2 is a chain of steps joined by → arrows, in the order a customer meets them.",
    "Slide 3 must be concrete — a real channel, a real first move, not a slogan.",
    "Slide 5 questions the wasted step, never the value of the underlying work.",
    "No statistics, prices, or capabilities unless they appear in the proof list.",
  ],
  frames: [
    {
      role: "The comparison",
      purpose:
        "Name what they use today, then the step this business removes. Curiosity in one breath.",
      alt: "A corridor of closed office doors, lights on, nobody there",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.58) 22%, rgba(0,0,0,0.30) 45%, rgba(0,0,0,0.20) 70%, rgba(0,0,0,0.55) 100%)",
      box: { top: 490, left: 76, right: 76, gap: 18 },
      wordmark: true,
      photo: "establish",
      lines: [
        { slot: "hookName", size: 196, weight: 800 },
        { slot: "hookTurn", size: 96, weight: 700 },
        { slot: "hookStep", size: 96, weight: 700 },
      ],
    },
    {
      role: "The friction",
      purpose: "The annoying steps the old way forces on them, as a chain.",
      alt: "A cluttered desk mid-task",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.30) 30%, rgba(0,0,0,0.34) 52%, rgba(0,0,0,0.56) 74%, rgba(0,0,0,0.62) 100%)",
      box: { top: 1120, left: 40, right: 40, gap: 14 },
      photo: "friction",
      lines: [
        { slot: "gripLead", size: 100, weight: 800 },
        { slot: "gripStepA", size: 66, weight: 700 },
        { slot: "gripStepB", size: 66, weight: 700 },
      ],
    },
    {
      role: "The easier way",
      purpose: "How it works here instead, concretely, in one move.",
      alt: "Someone glancing at their phone, relaxed",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.50) 26%, rgba(0,0,0,0.30) 46%, rgba(0,0,0,0.14) 68%, rgba(0,0,0,0.48) 100%)",
      box: { top: 96, left: 40, right: 40, gap: 10 },
      photo: "method",
      lines: [
        { slot: "wayA", size: 80, weight: 800 },
        { slot: "wayB", size: 80, weight: 800 },
        { slot: "wayC", size: 80, weight: 800 },
      ],
    },
    {
      role: "The result",
      purpose: "The payoff, stated plainly. Only claims backed by proof.",
      alt: "A quiet room at night, work already done",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.42) 26%, rgba(0,0,0,0.20) 50%, rgba(0,0,0,0.28) 74%, rgba(0,0,0,0.60) 100%)",
      box: { top: 440, left: 40, right: 40, gap: 18 },
      photo: "result",
      lines: [
        { slot: "winLead", size: 106, weight: 800 },
        { slot: "winA", size: 74, weight: 700 },
        { slot: "winB", size: 74, weight: 700 },
      ],
    },
    {
      role: "The question",
      purpose: "A short question that makes the old routine look like a choice.",
      alt: "Repetitive stacked objects",
      scrim:
        "linear-gradient(180deg, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.58) 24%, rgba(0,0,0,0.44) 46%, rgba(0,0,0,0.38) 70%, rgba(0,0,0,0.58) 100%)",
      box: { top: 470, left: 40, right: 40, gap: 12 },
      arrow: true,
      wordmark: true,
      photo: "repetition",
      lines: [
        { slot: "askA", size: 98, weight: 800 },
        { slot: "askB", size: 98, weight: 800 },
      ],
    },
  ],
  slots: [
    { key: "hookName", label: "1 · Name", intent: "The alternative, named plainly.", max: 16 },
    { key: "hookTurn", label: "1 · Turn", intent: "The pivot, e.g. 'but you never'.", max: 22 },
    { key: "hookStep", label: "1 · Step cut", intent: "The step this business removes.", max: 22 },
    { key: "gripLead", label: "2 · Lead", intent: "Names the recurring chore.", max: 20 },
    { key: "gripStepA", label: "2 · Steps A", intent: "First half of the step chain.", max: 30 },
    { key: "gripStepB", label: "2 · Steps B", intent: "Second half, ending in the worst part.", max: 30 },
    { key: "wayA", label: "3 · Line 1", intent: "Opens the alternative route.", max: 24 },
    { key: "wayB", label: "3 · Line 2", intent: "Who or what does the work.", max: 24 },
    { key: "wayC", label: "3 · Line 3", intent: "Where it happens, concretely.", max: 24 },
    { key: "winLead", label: "4 · Headline", intent: "The result in a few words.", max: 18 },
    { key: "winA", label: "4 · Support 1", intent: "What the customer didn't have to do.", max: 24 },
    { key: "winB", label: "4 · Support 2", intent: "A second thing they didn't have to do.", max: 24 },
    { key: "askA", label: "5 · Question 1", intent: "First half of the closing question.", max: 20 },
    { key: "askB", label: "5 · Question 2", intent: "Second half, ending in a question mark.", max: 20 },
  ],
};
