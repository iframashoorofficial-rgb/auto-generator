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
  "Text length depends on the format — obey the density rule given for this asset. Never apply one word count to everything.",
  "Captions are written like a person typing, lowercase is fine, no formal punctuation required.",
  "Two to four hashtags, specific to the niche. Never a wall of them.",
  "No call to action on a meme. A joke that ends in 'book a demo' stops being a joke.",
];

/** A quick check for output that slipped back into brand voice. */
export function bannedPhrasesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => lower.includes(p));
}

/* ---- Caption skeletons ------------------------------------------------- */

/**
 * Viral caption *shapes*, for transplanting.
 *
 * The mechanic seen in the references: keep the syntax of a line that already
 * worked and substitute the brand's situation into it.
 *
 *   POV: the homeless guy asks you for money but you are lowkey as broke as him
 *   POV: oxyplus is due and your office is lowkey already hydrated
 *
 * Same rhythm, same slang, different subject. Shapes rather than references —
 * naming an actual viral video dates the output within weeks.
 */
export interface CaptionSkeleton {
  id: string;
  /** The frame, with <slots> for the brand's specifics. */
  shape: string;
  /** What has to be true for it to land. */
  note: string;
}

export const CAPTION_SKELETONS: CaptionSkeleton[] = [
  { id: "pov-lowkey", shape: "POV: <thing happens> and you are lowkey <unexpected state>", note: "The second half must undercut the first." },
  { id: "pov-plain", shape: "POV: <a situation the audience is living right now>", note: "Second person. No setup." },
  { id: "dont-mean-to-alarm", shape: "I don't mean to alarm anyone but <oddly mundane announcement>", note: "The gap between the alarm and the mundanity is the joke." },
  { id: "me-knowing", shape: "me <doing small thing> knowing <the thing is already handled>", note: "Smugness played completely straight." },
  { id: "me-pretending", shape: "me <visible action> pretending <the real reason>", note: "Confession framed as observation." },
  { id: "nobody", shape: "nobody:\nabsolutely nobody:\n<audience>: <the unhinged habit>", note: "The behaviour must be unnecessary and universal." },
  { id: "two-types", shape: "there are two types of <audience>: <A> and <B>", note: "Both recognisable. One is the viewer." },
  { id: "not-me", shape: "not me <doing the embarrassing thing> again", note: "Self-own, no punchline needed." },
  { id: "the-way-i", shape: "the way i <overreaction> over <tiny thing>", note: "Scale mismatch carries it." },
  { id: "tell-me-without", shape: "tell me you <trait> without telling me you <trait>", note: "The tell must be weirdly precise." },
  { id: "started-as", shape: "started as <small thing> and now <absurd escalation>", note: "The escalation should be true, not exaggerated." },
  { id: "used-to-assume", shape: "used to assume <common belief> until i checked <what actually happens>", note: "Educational, first person, no lecture." },
  { id: "if-cant-explain", shape: "if <provider> can't explain <process> in plain words, i'm not <trusting them with it>", note: "A standard, stated flatly." },
  { id: "no-one-warns", shape: "no one warns you about <the unglamorous part>", note: "Names what everyone quietly knows." },
  { id: "still-thinking", shape: "still thinking about <the small thing that happened>", note: "Understated. The detail is the joke." },
  { id: "the-audacity", shape: "the audacity of <thing> to <do the mildly annoying thing>", note: "Mock-outrage at something trivial." },
  { id: "asked-for-one", shape: "asked for <one simple thing>. got <the elaborate wrong thing>.", note: "Two beats, nothing more." },
  { id: "genuinely-asking", shape: "genuinely asking — <the question everyone has but nobody says>", note: "Sincere, invites replies." },
  { id: "day-n-of", shape: "day <n> of <mundane ongoing struggle>", note: "The number should be absurdly high." },
  { id: "nobody-talks-about", shape: "nobody talks about <real unglamorous problem>", note: "Then actually say the thing." },
  { id: "we-need-to-talk", shape: "we need to talk about <mundane thing treated as serious>", note: "Tone mismatch is the joke." },
  { id: "imagine-explaining", shape: "imagine explaining <normal industry thing> to someone outside it", note: "The absurdity is real, not invented." },
  { id: "found-out", shape: "found out <fact> and i haven't recovered", note: "Fact must be genuinely surprising." },
  { id: "at-what-point", shape: "at what point does <common practice> stop being normal", note: "A question that argues." },
  { id: "everyone-has-that", shape: "everyone has that one <thing> — mine is <specific>", note: "Specificity is everything." },
];

export function skeletonById(id: string): CaptionSkeleton | undefined {
  return CAPTION_SKELETONS.find((s) => s.id === id);
}

/* ---- Slide templates --------------------------------------------------- */

/**
 * A fixed slide-by-slide skeleton, filled with the brand's own details.
 *
 * Distinct from a POST_PATTERN, which shapes one line. A template shapes a
 * whole multi-slide argument, and its power is in the sequence.
 */
export interface SlideTemplate {
  id: string;
  label: string;
  /** One job per slide, in order. Handed to the model verbatim. */
  slides: string[];
  /** The rule that makes or breaks it. */
  critical: string;
}

export const SLIDE_TEMPLATES: SlideTemplate[] = [
  {
    id: "competitor-contrast",
    label: "Competitor contrast",
    slides: [
      'Hook: "<competitor or the usual way> but <our single difference>". Four to eight words. Name it plainly and claim nothing about them that is not verifiably true.',
      "Their process as a COUNTABLE CHAIN of at least four steps joined by arrows, e.g. unlock -> open app -> wait -> snap -> log. It must feel long.",
      "Our version of the same job in ONE step. Begin with 'Or:'. The asymmetry against the previous slide is the entire argument.",
      "Proof: one hard, specific number taken from the brand's real proof list. Never 'fast', never 'better', never a number that was not supplied.",
      "Close with a question that makes the point for them, e.g. 'is the <extra step> actually adding anything?', plus a downward arrow. No 'book a demo'.",
    ],
    critical:
      "Slide 2 must list at least four steps and slide 3 exactly one. If slide 2 is short the template collapses and the post is pointless.",
  },
  {
    id: "before-after-routine",
    label: "Before / after routine",
    slides: [
      "The moment the problem shows up, with a specific time or number.",
      "The scramble that follows, told as something that actually happened.",
      "The turn: what changed, in one sentence, no fanfare.",
      "Now: the same situation, boring. 'i don't think about it any more.'",
      "Brand named as an afterthought, not a pitch.",
    ],
    critical: "Slide 4 must be underwhelming on purpose. Relief, not triumph.",
  },
];

export function templateById(id: string): SlideTemplate | undefined {
  return SLIDE_TEMPLATES.find((t) => t.id === id);
}

/* ---- Text density ------------------------------------------------------ */

/**
 * Words per text block, by format.
 *
 * Replaces a single global rule that was simply wrong: the reference posts
 * that lay a rant over a clip run 30-60 words, while a carousel slide dies
 * past about eight.
 */
export const TEXT_DENSITY: Record<string, { min: number; max: number; note: string }> = {
  carousel: { min: 3, max: 9, note: "Read in about a second. One idea per slide." },
  reel: { min: 3, max: 9, note: "One line per beat, readable while it is on screen." },
  meme: { min: 3, max: 20, note: "Short enough to take in at a glance." },
  clip: {
    min: 30,
    max: 60,
    note: "A rant, broken into short centred lines. Long is correct here.",
  },
};

export function densityFor(kind: string) {
  return TEXT_DENSITY[kind] ?? TEXT_DENSITY.carousel;
}

/* ---- Voice for the text-over-clip format ------------------------------- */

/**
 * The reference posts are not all jokes — two of the four are earnest. What
 * they share is voice, which is a far more reliable target than "be funny".
 */
export const CLIP_VOICE_RULES = [
  "Write in the FIRST PERSON, as the person filming. Never as the brand.",
  "All lowercase. No full stop at the end of a line. Run-on sentences are correct here.",
  "Be absurdly specific: an exact time, an exact count, named places. '10:17 on a tuesday', '14 people', 'six days a week'.",
  "Tell one small true story: what happened, the overreaction around it, then 'now i don't think about it'.",
  "Mention the brand once, late, like an afterthought. Never sell.",
  "No call to action, and no hashtags inside the overlay text.",
  "The background footage is UNRELATED to the product: an ordinary person doing an ordinary thing. Never describe a product shot.",
];

/* ---- Gen Z voice ------------------------------------------------------- */

/**
 * What actually reads as funny to this audience.
 *
 * Written as constraints, not vibes. "Be funny for Gen Z" produces a brand
 * doing a bit, which is the single most repellent thing on the timeline. The
 * rules below are about *stance* — who is speaking and how much they care —
 * because that is what the audience is really reading.
 */
export const GENZ_VOICE = [
  "lowercase. always. capitals read as a press release.",
  "no exclamation marks. no emoji. the flatter the delivery, the funnier it is.",
  "never explain the joke and never land on a punchline. stop one beat early and let it sit.",
  "the poster is the loser of the story, never the expert. self-deprecating, never superior, never teaching.",
  "start from ONE true mundane detail and escalate it further than is reasonable. the escalation is the joke; the detail makes it land.",
  "specific nouns beat adjectives every time — a file name, a timestamp, an amount, a day of the week. 'a folder called final_v3' not 'messy files'.",
  "if a brand could put the line in a press release, delete it and write a worse-behaved one.",
  "the last line should be the shortest and the most deadpan.",
  "name the shared condition: procrastination, avoidance, sunday dread, doing admin at 1am, being perceived at work.",
  "natural constructions are fine when they arrive honestly: 'not me…', 'the way…', 'no because…', 'why is…', 'genuinely', 'lowkey'. one per post at most.",
  "never force slang. dated slang ('yeet', 'on fleek', 'adulting', 'epic', 'rizz') is worse than plain english.",
  "irony is the default register. sincerity only in the very last line, if at all.",
];

/**
 * The bar the writing has to clear before it ships.
 *
 * Stated as a test the model applies to its own output, because a vague
 * instruction to be funny is satisfied by a pun.
 */
export const FUNNY_BAR = [
  "TEST EVERY LINE: would a stranger scrolling at 1am exhale through their nose? if not, it is filler — rewrite it.",
  "TEST: could this exact post work for any other company? if yes, it is not specific enough to be funny. rewrite with this brand's real details.",
  "TEST: does it read like a person who is mildly annoyed, or like a company being playful? if it is the second one, start again.",
  "The joke must still carry ONE true, specific thing the product does. Funny that sells nothing is a meme; funny that explains nothing is useless. Land the benefit inside the joke, not after it.",
];

/**
 * Backgrounds for the funny formats.
 *
 * A meme is not a photograph of the product. The reference posts use a
 * laughing cat, a bloke in a hoodie, someone reacting — footage whose emotion
 * carries the joke while the text does the selling. Left to itself the model
 * writes "a tidy desk with a laptop", which is an advert.
 *
 * Phrased as stock-library searches because that is where they get resolved.
 */
/**
 * Framing matters as much as the subject. Stock search returns extreme
 * close-ups for a bare emotion word, and a close-up cropped to 9:16 is a
 * forehead. Naming the shot keeps the whole person in frame.
 */
export const REACTION_SUBJECTS = [
  "cat sitting looking at camera",
  "cat unimpressed medium shot",
  "dog tilting head looking at camera",
  "woman laughing medium shot",
  "man covering face with hands waist up",
  "woman rolling eyes medium shot",
  "person falling onto sofa full body",
  "man turning to look at camera waist up",
  "woman staring blankly medium shot",
  "man shrugging waist up",
  "woman laughing pointing medium shot",
  "person sighing at desk waist up",
  "person walking away full body",
  "person lying on floor full body",
  "man nodding slowly medium shot",
  "woman surprised double take medium shot",
  "person peeking over laptop waist up",
  "person throwing hands up waist up",
];

/** Rotate so a batch never repeats a reaction. */
export function reactionFor(i: number, seed: number): string {
  return REACTION_SUBJECTS[(i * 5 + seed) % REACTION_SUBJECTS.length];
}

/* ---- Trending formats -------------------------------------------------- */

/**
 * Formats that are current right now, as opposed to the durable shapes above.
 *
 * CAPTURED: August 2026. THIS LIST GOES STALE — a brand using a format two
 * months after its peak reads worse than a brand using no format at all.
 * Refresh it by editing this array; nothing else needs to change.
 *
 * Only formats that survive our constraints are here: we lay text over stock
 * footage, so anything requiring choreography, a specific licensed sound, or
 * a person performing to camera is excluded no matter how big it is.
 */
export const TRENDING_CAPTURED = "2026-08";

export interface TrendingFormat {
  id: string;
  label: string;
  /** How to build it, given to the model verbatim. */
  shape: string;
  /** Why it is working right now. */
  note: string;
  kinds: AssetKind[];
  /** Reels only: the sound direction that goes with it. */
  audio?: string;
}

export const TRENDING_FORMATS: TrendingFormat[] = [
  {
    id: "how-different-our-lives",
    label: "How different our lives are",
    shape:
      "Two lives, same moment, side by side. 'you: <their version>' / 'me: <our version>'. No commentary — the gap speaks.",
    note: "The comparison format currently everywhere. Fits a competitor contrast without naming anyone.",
    kinds: ["carousel", "meme", "clip"],
  },
  {
    id: "worth-the-money",
    label: "Worth the money",
    shape:
      "A blunt list of things that were actually worth paying for, with the real prices. One of them is ours, placed mid-list, never first or last.",
    note: "Reads as a recommendation rather than an ad precisely because ours is not the hero.",
    kinds: ["carousel", "reel"],
  },
  {
    id: "glow-up-carousel",
    label: "Glow-up",
    shape:
      "Slide 1 is the honest before, unflattering and specific. The middle slides are the unglamorous middle. The last slide is the after, understated.",
    note: "Transformation without triumph. The before has to be genuinely bad or nobody believes the after.",
    kinds: ["carousel"],
  },
  {
    id: "bob-repetition",
    label: "Repetition",
    shape:
      "The same short line repeated with one word changing each time, escalating, then a final line that breaks the pattern.",
    note: "The rhythm does the work. The break at the end is the joke.",
    kinds: ["reel", "meme"],
  },
  {
    id: "my-favorite-person",
    label: "My favourite person",
    shape:
      "'my favourite type of <role> is the one who <oddly specific behaviour>'. Affectionate, not sarcastic.",
    note: "Warm rather than cynical, which stands out in a feed of complaints.",
    kinds: ["meme", "clip"],
  },
  {
    id: "sax-escalation",
    label: "Escalation into chaos",
    shape:
      "Beats build calmly, then one beat where everything goes wrong at once. The last beat is the aftermath, deadpan.",
    note: "Structural version of the sound-spike trend: build, break, flat reaction.",
    kinds: ["reel"],
    audio: "a track that builds and drops hard on the third beat",
  },
];

export function trendingFor(kind: AssetKind): TrendingFormat[] {
  return TRENDING_FORMATS.filter((t) => t.kinds.includes(kind));
}

/**
 * Pick a trending format for one slot, or nothing.
 *
 * Roughly one card per batch, so the deck feels current without every post
 * being dated the moment the trend passes.
 */
export function trendingSlot(i: number, kind: AssetKind, seed: number): TrendingFormat | undefined {
  if (i !== 1) return undefined;
  const pool = trendingFor(kind);
  return pool.length ? pool[(seed + i) % pool.length] : undefined;
}
