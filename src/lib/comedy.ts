/**
 * How to be funny, and how to look native.
 *
 * The composer kept producing competent marketing rather than something a
 * person would actually stop for. Two things were missing: a recognisable
 * post *structure*, and any real theory of the joke.
 *
 * Deliberately durable structures rather than this month's trending audio.
 * Naming a specific viral meme dates the output within weeks and reads as a
 * brand trying too hard — the shapes below have worked for years because they
 * are formats, not references.
 */

import type { AssetKind } from "./assets";

export interface PostPattern {
  id: string;
  /** The recognisable shape, shown to the model as a template. */
  template: string;
  /** What makes this land, in one line. */
  note: string;
  /** Which formats it suits. */
  kinds: AssetKind[];
  /** True when the pattern is built to be funny rather than useful. */
  comic: boolean;
}

export const POST_PATTERNS: PostPattern[] = [
  {
    id: "pov",
    template: 'POV: <a situation the audience is living, described in second person>',
    note: "Works because the viewer recognises themselves in the first two seconds.",
    kinds: ["reel", "meme"],
    comic: true,
  },
  {
    id: "nobody",
    template: "Nobody:\nAbsolutely nobody:\n<the audience>: <the unhinged thing they actually do>",
    note: "The joke is the gap between how unnecessary the behaviour is and how universal.",
    kinds: ["meme", "reel"],
    comic: true,
  },
  {
    id: "tell-me-without",
    template: "Tell me you <trait> without telling me you <trait>. I'll go first: <specific tell>",
    note: "Only funny if the tell is oddly specific. Generic kills it.",
    kinds: ["meme", "reel"],
    comic: true,
  },
  {
    id: "green-red-flags",
    template: "🚩 <thing the audience should run from>\n✅ <the opposite>",
    note: "Take a real stance. A safe flag is not a flag.",
    kinds: ["carousel", "meme"],
    comic: true,
  },
  {
    id: "me-explaining",
    template: "Me explaining <thing> to <person who does not care>",
    note: "The comedy is the mismatch of effort and audience interest.",
    kinds: ["meme", "reel"],
    comic: true,
  },
  {
    id: "how-it-started",
    template: "How it started: <the optimistic version>\nHow it's going: <the reality>",
    note: "Needs a genuine fall between the two panels.",
    kinds: ["carousel", "meme"],
    comic: true,
  },
  {
    id: "starter-pack",
    template: "The <specific role> starter pack: <4-6 oddly precise items>",
    note: "Every item must be a detail an outsider would never guess.",
    kinds: ["carousel", "meme"],
    comic: true,
  },
  {
    id: "ranking",
    template: "<Category> ranked from worst to best. <n> is going to upset people.",
    note: "Pick a real order and defend it. Fence-sitting is boring.",
    kinds: ["carousel", "reel"],
    comic: true,
  },
  {
    id: "stop-doing",
    template: "Stop <common practice>. Do <better thing> instead.",
    note: "Blunt, useful, no preamble.",
    kinds: ["carousel", "reel"],
    comic: false,
  },
  {
    id: "nobody-talks-about",
    template: "Nobody talks about <the unglamorous real problem>",
    note: "Names the thing everyone in the industry quietly knows.",
    kinds: ["reel", "carousel"],
    comic: false,
  },
  {
    id: "wish-i-knew",
    template: "<n> things I wish I knew before <milestone the audience is heading for>",
    note: "Concrete, earned, no platitudes.",
    kinds: ["carousel", "reel"],
    comic: false,
  },
  {
    id: "real-reason",
    template: "The real reason <common frustration> happens",
    note: "Deliver an actual explanation, not a tease.",
    kinds: ["reel", "carousel"],
    comic: false,
  },
  {
    id: "text-thread",
    template: "<a short exchange written as messages, the last one landing the joke>",
    note: "Reads instantly. Keep it to four lines or fewer.",
    kinds: ["meme", "carousel"],
    comic: true,
  },
  {
    id: "two-types",
    template: "There are two types of <audience>: <A> and <B>",
    note: "Both types must be recognisable. One is the viewer.",
    kinds: ["meme", "carousel"],
    comic: true,
  },
];

export function patternsFor(kind: AssetKind, comicOnly = false): PostPattern[] {
  return POST_PATTERNS.filter(
    (p) => p.kinds.includes(kind) && (!comicOnly || p.comic),
  );
}

/**
 * The rules that actually make a joke work.
 *
 * Written as instructions rather than adjectives — telling a model to "be
 * funny" produces puns, which is the least funny thing available.
 */
export const COMEDY_RULES = [
  "Specificity is the joke. 'Admin is annoying' is nothing; 'you have a spreadsheet named final_FINAL_v3' is a joke. Always reach for the oddly precise detail.",
  "Build the joke from something true about THIS audience's week. If it would work for any business, it is not funny, it is filler.",
  "Punch at the situation, never at the customer. The audience should feel seen, not mocked.",
  "The brand is the person who noticed the absurdity, not the hero who fixes it. Sell nothing until the last beat, if at all.",
  "No puns on the product name. No wordplay as the main joke. No 'we've all been there'.",
  "Understate it. The funniest line is usually the flattest one.",
  "If a line needs an emoji to read as a joke, the line is not a joke.",
];

/** Phrases that instantly mark a post as brand-written. */
export const BANNED_PHRASES = [
  "unlock",
  "elevate",
  "game-changer",
  "game changer",
  "revolutionise",
  "revolutionize",
  "seamless",
  "supercharge",
  "in today's fast-paced world",
  "we've all been there",
  "let's dive in",
  "the secret sauce",
  "level up",
  "look no further",
  "say goodbye to",
  "it's a no-brainer",
];

/** Conventions that make a post look native rather than advertised. */
export const NATIVE_RULES = [
  "The first line must work with no context. Front-load the hook — the interesting word goes in the first three words.",
  "On-screen text is read in about a second. Eight words per line is the ceiling; fewer is better.",
  "Captions are written like a person typing, lowercase is fine, no formal punctuation required.",
  "Two to four hashtags, specific to the niche. Never a wall of them.",
  "No call to action on a meme. A joke that ends in 'book a demo' stops being a joke.",
];

/** A quick check for output that slipped back into brand voice. */
export function bannedPhrasesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}
