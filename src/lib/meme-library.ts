/**
 * The approved meme library.
 *
 * The single place a meme's visuals may come from. Nothing here is searched for
 * at runtime and nothing falls back to stock footage: if a trend cannot be
 * matched to an approved asset, no meme is produced. That rule is the whole
 * point — the previous system answered every meme with a random Pexels clip of
 * someone laughing, which is what made the output read as an advert.
 *
 * REPLACING THE LIBRARY (roughly every two months):
 *   1. Drop new files into public/memes/templates | reactions | backgrounds.
 *   2. Move outgoing entries into RETIRED — move, never delete.
 *   3. Add the new ones and bump LIBRARY_VERSION.
 * Nothing else in the app refers to a template, so that is the whole procedure.
 *
 * Retiring stops an asset being *used*; it never deletes what was *made*.
 * `assetById` searches retired entries too, so cards already in someone's deck
 * keep resolving their template and keep rendering.
 */

/* ---- mechanics ---------------------------------------------------------- */

/**
 * The join between a researched trend and an approved asset.
 *
 * Deliberately not the trend's *name*: names churn weekly and the library would
 * be stale within a fortnight. A trend is classified into mechanics, an asset
 * declares which it can carry, and a brand-new trend still finds a home.
 */
export type TrendMechanic =
  // contrast family — two or more competing things
  | "comparison"
  | "choice"
  | "dilemma"
  | "temptation"
  | "before-after"
  | "ranking"
  // state family — one subject, one attitude
  | "denial"
  | "understatement"
  | "collapse"
  | "celebration"
  | "relief"
  | "undercut"
  // sequence family — a list that moves
  | "escalation"
  | "reveal"
  | "pov";

/**
 * Contrast mechanics need two or more things to put against each other; state
 * mechanics have exactly one subject. Matching across the families produces a
 * card whose text has nowhere to go, so the matcher checks family first.
 */
export const MECHANIC_FAMILY: Record<TrendMechanic, "contrast" | "state" | "sequence"> = {
  comparison: "contrast",
  choice: "contrast",
  dilemma: "contrast",
  temptation: "contrast",
  "before-after": "contrast",
  ranking: "contrast",
  denial: "state",
  understatement: "state",
  collapse: "state",
  celebration: "state",
  relief: "state",
  undercut: "state",
  escalation: "sequence",
  reveal: "sequence",
  pov: "sequence",
};

/* ---- licensing ---------------------------------------------------------- */

/**
 * Rights status, recorded per asset from the moment it enters the library so a
 * pre-release review is a query rather than fifteen acts of remembering.
 */
export type LicenceStatus =
  /** Owned, original, or licensed for commercial use. */
  | "cleared"
  /** Not yet assessed. The default for anything from the internet. */
  | "pending"
  /** Assessed and not usable. Never offered to the generator. */
  | "restricted";

interface Provenance {
  licence: LicenceStatus;
  source: string;
  licenceNote: string;
}

/* ---- assets ------------------------------------------------------------- */

/** A text area on a template, positioned as a % of the template's own box. */
export interface TemplateSlot {
  name: string;
  guidance: string;
  maxWords: number;
  maxChars: number;
  /** Percentages of the template box, not of the card. */
  x: number;
  y: number;
  width: number;
  height: number;
  align: "left" | "center" | "right";
  /** Degrees. Some templates have tilted surfaces to sit text on. */
  rotate?: number;
  /** Wrapping past this climbs over faces or off the artwork. */
  maxLines: number;
  /**
   * Always explicit. There is no safe default: white-with-outline vanishes on a
   * white panel, plain black vanishes on a photograph.
   */
  style: "outlined" | "plain-dark";
  optional?: boolean;
}

/** A full-frame image with text slots. */
export interface MemeTemplate extends Provenance {
  kind: "template";
  id: string;
  name: string;
  file: string;
  /**
   * Width / height, and it must match the file exactly.
   *
   * The renderer sizes the artwork's box from this and then places every slot
   * inside that box, so a wrong figure does not letterbox slightly oddly — it
   * slides every label off the thing it labels.
   */
  aspect: number;
  /** Letterbox colour. Cut-out artwork on white needs white bars, not the card's dark. */
  background: string;
  /** The joke mechanic, handed to the writer verbatim. */
  shape: string;
  serves: TrendMechanic[];
  slots: TemplateSlot[];
  /** Text already drawn into the artwork. The writer must not repeat or contradict it. */
  bakedText?: string;
  /**
   * False while the artwork is still being commissioned.
   *
   * The spec is complete and the record stays — flipping this to true when the
   * file lands is the whole activation. An unavailable template is never
   * offered to the generator, so it cannot produce a card with no picture.
   */
  available: boolean;
}

/** A clip composited over a background as a picture-in-picture reaction. */
export interface ReactionAsset extends Provenance {
  kind: "reaction";
  id: string;
  name: string;
  file: string;
  /** Green removed, so it floats with no border. */
  transparent: boolean;
  /** What literally happens. The model never sees a frame — this is the asset to it. */
  description: string;
  /** The setup shape this pays off. */
  reactionTo: string;
  serves: TrendMechanic[];
  /** Named beats of setup text. One clip needs a claim; another needs state + trigger. */
  setupSlots: { name: string; guidance: string; maxWords: number }[];
  /**
   * Where the cut-out stands.
   *
   * Per clip, because they are not interchangeable: a wide clapping shot wants
   * the middle, a small stare works from a corner, and two clips in the same
   * spot at the same size makes every card look like the same card. Was a
   * `"bottom" | "center"` field that nothing ever read, which is why they all
   * ended up stacked in the middle.
   */
  place: {
    /** Which edge of the text column it hugs. */
    x: "left" | "center" | "right";
    /** How far up off the bottom, as a % of the card's height. 0 sits flush. */
    lift: number;
    /**
     * Stand on the card's real bottom edge, below the platform safe zone.
     *
     * The safe zone stops 24% up because TikTok and Instagram paint a caption
     * and an action rail across that band, so anything inside it is covered in
     * the feed. A cut-out standing ON the bottom edge looks right and accepts
     * that the platform will crop its feet — which for a clip that is all face
     * and arms is the correct trade.
     */
    full?: boolean;
  };
  /**
   * Width / height of the clip, and it must match the file exactly.
   *
   * The card gives the cut-out a box of this shape and draws the whole frame
   * into it, so a wrong figure stretches the subject. Cropping to a nicer shape
   * was tried and abandoned: every crop is a guess about footage, and the
   * guesses kept cutting people's heads.
   */
  frame: number;
  /**
   * % of the CARD'S HEIGHT the inset occupies.
   *
   * Height, not width, because these clips are a mix of 16:9 and 9:16 sources:
   * a width share that gave a portrait clip a sensible inset turned a landscape
   * one into a strip 70px tall, which is why nobody could find the reaction on
   * the card. Width follows from `aspect`, capped at the text column.
   */
  size: number;
  /** Hard cap on the same share. Without it a clip scales up to fill the frame. */
  maxSize: number;
  /** A rhythmic clip loops visibly unless the cut lands on the beat. */
  rhythmic: boolean;
  /**
   * Crop-in factor applied when keying. Green-screen sources frame the subject
   * loosely, so at 1 the subject reads as a small figure marooned in the frame.
   */
  spokenLine?: string;
}

/**
 * A still backdrop for a reaction.
 *
 * A photograph, deliberately, where the text-driven formats get footage. The
 * cut-out is the only thing on the card that should move: two moving layers
 * read as two videos playing at once, and the subject stops being the thing
 * your eye goes to. It also means a reaction card decodes one video instead of
 * two.
 */
export interface ReactionPlate extends Provenance {
  kind: "plate";
  id: string;
  file: string;
  description: string;
}

/** Ambient footage for the text-driven formats. Never illustrates the text. */
export interface BackgroundClip extends Provenance {
  kind: "background";
  id: string;
  file: string;
  description: string;
  /** Busy footage needs a heavier scrim and fewer words. */
  busyness: "calm" | "moderate" | "busy";
  /**
   * What the plate is FOR.
   *
   * `nature` is empty landscape — no people, no story, nothing competing. It is
   * the only kind a reaction may float over: a keyed cut-out standing in front
   * of someone else's kitchen reads as two videos fighting, not as a meme.
   * `scene` is footage with people in it, which only suits the text-driven
   * formats, where the motion is behind a block of copy rather than behind a
   * second performer.
   */
  plate: "nature" | "scene";
}

/** A text-over-video format. The copy is the content; the footage is motion. */
export interface CopyFormat {
  kind: "copy";
  id: string;
  name: string;
  /** Empty for the non-joke format — it pairs with topics, not comic shapes. */
  serves: TrendMechanic[];
  shape: string;
  minLines: number;
  maxLines: number;
  minWords: number;
  maxWords: number;
  /** Handed to the writer verbatim, above the shared voice rules. */
  rules: string[];
}

export type LibraryAsset = MemeTemplate | ReactionAsset;

export const LIBRARY_VERSION = 2;
export const LIBRARY_APPROVED = "2026-08-22";

/* ---- 01-05: image templates --------------------------------------------- */

/**
 * Four are live; This Is Fine is specced but has no artwork yet, so it carries
 * `available: false` and is skipped by `activeAssets()` until the file lands.
 *
 * All five are still `licence: "pending"` — they are the well-known reference
 * images, standing in until originals are commissioned. Swapping the artwork
 * later changes `file`, `source` and `licence` only: the slots were measured as
 * percentages of the template box, so they survive as long as the replacement
 * keeps the same staging.
 */
export const MEME_TEMPLATES: MemeTemplate[] = [
  {
    kind: "template",
    id: "drake-hotline-bling",
    name: "Drake",
    file: "/memes/templates/drake-hotline-bling.jpg",
    aspect: 1,
    background: "#ffffff",
    shape:
      "Two stacked panels. Top: the subject recoils, rejecting. Bottom: the subject approves, pleased. Reject the ordinary option, approve the specific one.",
    serves: ["choice", "comparison"],
    slots: [
      { name: "reject", guidance: "The ordinary, sensible option. Must be genuinely reasonable — a strawman kills the joke.", maxWords: 9, maxChars: 55, x: 52, y: 5, width: 44, height: 40, align: "center", maxLines: 3, style: "plain-dark" },
      { name: "approve", guidance: "The specific, better option. Similar length to reject — the swap is the joke.", maxWords: 9, maxChars: 55, x: 52, y: 55, width: 44, height: 40, align: "center", maxLines: 3, style: "plain-dark" },
    ],
    available: true,
    licence: "pending",
    source: "Hotline Bling music video (2015), two-panel crop.",
    licenceNote: "Copyrighted footage of an identifiable person. Realistically not clearable; substitute an original two-panel reject/approve asset.",
  },
  {
    kind: "template",
    id: "two-buttons",
    name: "Two Buttons",
    file: "/memes/templates/two-buttons.jpg",
    aspect: 898 / 1292,
    background: "#ffffff",
    shape:
      "A hand hovers over two buttons, each labelled with something the subject wants. Below, the same person sweats, unable to choose. Two things that cannot both be true.",
    serves: ["dilemma"],
    slots: [
      { name: "option_a", guidance: "First option. Wanted, and incompatible with the other.", maxWords: 8, maxChars: 45, x: 6, y: 10, width: 44, height: 15, align: "center", rotate: -8, maxLines: 3, style: "plain-dark" },
      { name: "option_b", guidance: "Second option. Equally wanted. Similar length to the first.", maxWords: 8, maxChars: 45, x: 45, y: 4, width: 45, height: 14, align: "center", rotate: -8, maxLines: 3, style: "plain-dark" },
      { name: "persona", guidance: "Who is stuck. Usually left empty.", maxWords: 3, maxChars: 20, x: 8, y: 62, width: 34, height: 7, align: "center", maxLines: 1, style: "outlined", optional: true },
    ],
    available: true,
    licence: "pending",
    source: "Daily Struggle / Two Buttons webcomic panel.",
    licenceNote: "One identifiable illustrator. More tractable than most here — an original redraw of the same staging clears it outright.",
  },
  {
    kind: "template",
    id: "buff-doge-vs-cheems",
    name: "Buff Doge vs Cheems",
    file: "/memes/templates/buff-doge-vs-cheems.jpg",
    aspect: 937 / 720,
    background: "#ffffff",
    shape:
      "Left: a hugely muscular figure. Right: a small, sad one. Label each. The left is the competent version, the right the pathetic one. No choice is offered — one is simply better.",
    serves: ["comparison", "before-after"],
    slots: [
      { name: "strong", guidance: "The competent version. Grammatically parallel with weak.", maxWords: 10, maxChars: 60, x: 2, y: 77, width: 46, height: 20, align: "center", maxLines: 2, style: "plain-dark" },
      { name: "weak", guidance: "The pathetic version. Same sentence shape, opposite content — the parallel is the joke.", maxWords: 10, maxChars: 60, x: 54, y: 77, width: 44, height: 20, align: "center", maxLines: 2, style: "plain-dark" },
      { name: "header", guidance: "Optional framing line.", maxWords: 8, maxChars: 45, x: 50, y: 2, width: 48, height: 16, align: "center", maxLines: 2, style: "plain-dark", optional: true },
    ],
    available: true,
    licence: "pending",
    source: "Two separately owned Shiba Inu photographs, edited.",
    licenceNote: "Needs both original photographers; one of the images is actively licensed commercially elsewhere.",
  },
  {
    kind: "template",
    id: "distracted-boyfriend",
    name: "Distracted Boyfriend",
    file: "/memes/templates/distracted-boyfriend.jpg",
    aspect: 3 / 2,
    background: "#000000",
    shape:
      "Someone walking with their partner turns to stare at a passer-by, and is caught doing it. Label the person, what they are committed to, and what caught their eye. The switch is a mistake.",
    serves: ["temptation"],
    slots: [
      { name: "new_thing", guidance: "The distraction. Two to four words.", maxWords: 6, maxChars: 35, x: 15, y: 64, width: 32, height: 13, align: "center", maxLines: 2, style: "outlined" },
      { name: "person", guidance: "Who is being tempted. Usually one or two words.", maxWords: 4, maxChars: 25, x: 49, y: 56, width: 24, height: 13, align: "center", maxLines: 2, style: "outlined" },
      { name: "current_thing", guidance: "The neglected commitment. Comparable in length to new_thing.", maxWords: 6, maxChars: 35, x: 74, y: 56, width: 24, height: 13, align: "center", maxLines: 2, style: "outlined" },
    ],
    available: true,
    licence: "pending",
    source: "Stock photograph with identifiable models.",
    licenceNote: "Hardest here. A licence is purchasable but standard stock terms bar unflattering depiction of models, and this image's joke is infidelity — buying it plausibly still does not permit this use.",
  },
  {
    kind: "template",
    id: "this-is-fine",
    name: "This Is Fine",
    file: "/memes/templates/this-is-fine.jpg",
    aspect: 580 / 282,
    background: "#000000",
    shape:
      "A character sits calmly while the room burns, then says everything is fine. Label what is actually on fire. The denial is supplied by the picture — never write it.",
    serves: ["denial"],
    bakedText: "THIS IS FINE.",
    slots: [
      { name: "disaster", guidance: "What is actually burning. A real, specific, ignored problem.", maxWords: 6, maxChars: 45, x: 3, y: 3, width: 44, height: 13, align: "center", maxLines: 2, style: "outlined" },
      { name: "persona", guidance: "Who is sitting in it pretending otherwise.", maxWords: 3, maxChars: 25, x: 8, y: 72, width: 34, height: 11, align: "center", maxLines: 1, style: "outlined", optional: true },
    ],
    available: true,
    licence: "pending",
    source: "Gunshow #648 'On Fire' by KC Green, 2013.",
    licenceNote: "The most clearable of the five — a single creator who already licenses this image commercially. Worth pursuing first.",
  },
];

/* ---- 06-10: reaction clips ---------------------------------------------- */

export const REACTIONS: ReactionAsset[] = [
  {
    kind: "reaction",
    id: "serious-baby",
    name: "Serious Baby",
    file: "/memes/reactions/serious-baby.mp4",
    transparent: true,
    frame: 1280 / 720,
    description:
      "A baby looks at the camera with a serious, faintly disappointed expression. Unimpressed and entirely unbothered.",
    reactionTo: "a claim, provocation or excuse that deserves no verbal answer",
    serves: ["understatement"],
    setupSlots: [
      { name: "claim", guidance: "The provocation. Something said with confidence that does not survive contact with the stare.", maxWords: 22 },
    ],
    place: { x: "left", lift: 0 },
    size: 22,
    maxSize: 40,
    rhythmic: false,
    licence: "pending",
    source: "YouTube, Yadro Green Screen — a re-upload, not the rights holder.",
    licenceNote: "Original clip's creator unknown. Downloaded outside YouTube-provided features.",
  },
  {
    kind: "reaction",
    id: "thought-i-was-stronger",
    name: "I Thought I Was Stronger",
    file: "/memes/reactions/thought-i-was-stronger.mp4",
    transparent: true,
    frame: 360 / 640,
    description:
      "Someone holding composure visibly gives way and becomes upset. A full emotional collapse from a standing start.",
    reactionTo: "a small final straw landing on someone who thought they were coping",
    serves: ["collapse"],
    setupSlots: [
      { name: "state", guidance: "The calm, confident position before it went wrong.", maxWords: 16 },
      { name: "trigger", guidance: "The small thing that arrives and undoes it. Must be minor — the size gap is the joke.", maxWords: 14 },
    ],
    place: { x: "center", lift: 5, full: true },
    // Tall because the clip is: shown whole, a 9:16 source is all height.
    size: 72,
    maxSize: 78,
    rhythmic: false,
    spokenLine: "I thought I was stronger than this.",
    licence: "pending",
    source: "Abby Lee Miller, Dance Moms (Lifetime), via a green-screen re-upload.",
    licenceNote: "Broadcast footage of an identifiable person via a non-owner. Realistically not clearable.",
  },
  {
    kind: "reaction",
    id: "crying",
    name: "Crying",
    file: "/memes/reactions/crying.mp4",
    transparent: true,
    frame: 1280 / 720,
    description: "A man crying openly and without restraint.",
    reactionTo: "a confident claim the speaker does not actually believe",
    serves: ["undercut"],
    setupSlots: [
      { name: "claim", guidance: "A claim about oneself stated with total confidence. The reaction reveals it is false — never say so in the text.", maxWords: 20 },
    ],
    place: { x: "left", lift: 0 },
    size: 27,
    maxSize: 40,
    rhythmic: false,
    licence: "pending",
    source: "Green-screen re-upload; uploader advertises free download.",
    licenceNote: "Redistribution of the green-screened file is plainly intended, which is not a licence for the underlying footage but is better than most here.",
  },
  {
    kind: "reaction",
    id: "shia-clapping",
    name: "Clapping",
    file: "/memes/reactions/shia-clapping.mp4",
    transparent: true,
    frame: 1280 / 720,
    description: "A man claps hard and repeatedly with visible enthusiasm. Sustained and rhythmic.",
    reactionTo: "a result that turned out better than anyone expected",
    serves: ["celebration"],
    setupSlots: [
      { name: "situation", guidance: "The unexpectedly good outcome. Must be modest — the joke is that the reaction is out of proportion, so a genuinely huge win kills it.", maxWords: 24 },
    ],
    place: { x: "center", lift: 0, full: true },
    size: 34,
    maxSize: 40,
    rhythmic: true,
    licence: "pending",
    source: "Shia LaBeouf, via a green-screen re-upload.",
    licenceNote: "Identifiable public figure via a non-owner. Same position as thought-i-was-stronger.",
  },
  {
    kind: "reaction",
    id: "cat-happy",
    name: "Happy Cat",
    file: "/memes/reactions/cat-happy.mp4",
    transparent: true,
    frame: 480 / 826,
    description: "A cat jumps repeatedly on the spot with visible delight. Sustained and rhythmic.",
    reactionTo: "an expected burden that failed to materialise",
    serves: ["relief"],
    setupSlots: [
      { name: "expectation", guidance: "The dread — how long or painful this was going to be.", maxWords: 16 },
      { name: "outcome", guidance: "The collapse of that expectation. The speaker benefits personally — this is relief, not applause.", maxWords: 16 },
    ],
    place: { x: "right", lift: 10 },
    size: 38,
    maxSize: 50,
    rhythmic: true,
    licence: "pending",
    source: "Green-screen re-upload, labelled a template by its uploader.",
    licenceNote: "Probably the most clearable reaction: no identifiable person, so no personality rights, and reuse is signalled.",
  },
];

/* ---- 11-15: text-driven formats ----------------------------------------- */

/**
 * Five formats sharing one rendering path and one background pool. They differ
 * only in how the copy is shaped, which is why they are data rather than code.
 *
 * 13, 14 and 15 exist to serve escalation, reveal and ranking — the three
 * mechanics nothing else in the library carries. Text over video is also the
 * only format here that can hold a variable-length list; every image template
 * is a fixed one-to-three slot contrast.
 */
export const COPY_FORMATS: CopyFormat[] = [
  {
    kind: "copy",
    id: "value-copy",
    name: "Value copy",
    serves: [],
    shape: "Second-person insight in three or four short sections. Not a joke — a point worth reading.",
    minLines: 3,
    maxLines: 4,
    minWords: 40,
    maxWords: 70,
    rules: [
      "Second person. Talk to them about their situation, not about yourself.",
      "One idea per line. A blank line between sections — they become spacing.",
      "The last line earns the point. It does not ask for a booking.",
      "This is the only format that may be plainly useful rather than funny. Do not force a joke into it.",
    ],
  },
  {
    kind: "copy",
    id: "pov-scenario",
    name: "POV",
    serves: ["pov"],
    shape: "One immersive second-person scenario the audience is living. Places the viewer inside it rather than describing it.",
    minLines: 1,
    maxLines: 2,
    minWords: 12,
    maxWords: 25,
    rules: [
      "Put the viewer in the situation. 'you are' beats 'when someone'.",
      "One oddly specific detail carries the whole thing. Generic scenarios are invisible.",
      "Never about the product. The product is what they wish existed while reading it.",
    ],
  },
  {
    kind: "copy",
    id: "escalation-spiral",
    name: "Escalating spiral",
    serves: ["escalation"],
    shape: "Four to six short lines that intensify. Line one is mundane; the last is alarming. The climb is the joke.",
    minLines: 4,
    maxLines: 6,
    minWords: 25,
    maxWords: 45,
    rules: [
      "Every line must be worse than the one above it. A line that does not escalate is a dead line — cut it.",
      "Start genuinely ordinary. Starting high leaves nowhere to climb.",
      "The last line is the only alarming one. Do not resolve it or explain it.",
      "Keep the lines the same grammatical shape so the escalation is the only thing changing.",
    ],
  },
  {
    kind: "copy",
    id: "setup-realisation",
    name: "Setup then realisation",
    serves: ["reveal"],
    shape: "A stated belief, then one line that reframes it. The turn is the joke.",
    minLines: 2,
    maxLines: 2,
    minWords: 15,
    maxWords: 30,
    rules: [
      "Line one is said with total confidence. Line two makes it land differently.",
      "The second line must REFRAME, never explain. If it restates line one, there is no turn and no joke.",
      "The reader should arrive a half-second before the second line does.",
    ],
  },
  {
    kind: "copy",
    id: "ranking-tier",
    name: "Ranking",
    serves: ["ranking"],
    shape: "A short ordered or contrasted list, three to five items, with a real ordering principle.",
    minLines: 3,
    maxLines: 5,
    minWords: 20,
    maxWords: 40,
    rules: [
      "The order must mean something — cost, effort, pain, time. A list with no principle is filler.",
      "Concrete units. '£0 / £200 / £2,000 a month' beats 'cheap / mid / expensive'.",
      "Never put the product at the top. A ranking that crowns you is an advert, and the reader stops reading.",
    ],
  },
];

/* ---- backgrounds --------------------------------------------------------- */

/**
 * Shared by every text-driven format. Stored once, never per template.
 *
 * These never illustrate the copy. They exist to supply motion so the post
 * reads as native short-form; matching footage to meaning re-creates the
 * literal-stock-photo look this library was built to remove.
 */
export const BACKGROUNDS: BackgroundClip[] = [
  { kind: "background", id: "bg-01", file: "/memes/backgrounds/bg-01.mp4", description: "everyday indoor scene", busyness: "calm", plate: "scene", licence: "cleared", source: "Pexels #12322641 by RDNE Stock project", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-02", file: "/memes/backgrounds/bg-02.mp4", description: "outdoor scene with movement", busyness: "moderate", plate: "scene", licence: "cleared", source: "Pexels #16172126 by Atahan Demir", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-03", file: "/memes/backgrounds/bg-03.mp4", description: "close indoor activity", busyness: "calm", plate: "scene", licence: "cleared", source: "Pexels #5925307 by Sora Shimazaki", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-04", file: "/memes/backgrounds/bg-04.mp4", description: "person walking, city street", busyness: "moderate", plate: "scene", licence: "cleared", source: "Pexels #6083372 by Keira Burton", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-05", file: "/memes/backgrounds/bg-05.mp4", description: "sand dunes, wind-carved lines", busyness: "calm", plate: "nature", licence: "cleared", source: "Pexels #19797595 by Andrey Denin", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-06", file: "/memes/backgrounds/bg-06.mp4", description: "shoreline, waves over flat sand", busyness: "calm", plate: "nature", licence: "cleared", source: "Pexels #19973189 by Dian Pradita Putri", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-07", file: "/memes/backgrounds/bg-07.mp4", description: "clear blue sky, one slow cloud", busyness: "calm", plate: "nature", licence: "cleared", source: "Pexels #30098016 by Mohit Singh", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-08", file: "/memes/backgrounds/bg-08.mp4", description: "canyon rock face", busyness: "calm", plate: "nature", licence: "cleared", source: "Pexels #20753636 by Vasilis Karkalas", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-09", file: "/memes/backgrounds/bg-09.mp4", description: "open sea at twilight", busyness: "calm", plate: "nature", licence: "cleared", source: "Pexels #35822284 by Gabriele Pace", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "background", id: "bg-10", file: "/memes/backgrounds/bg-10.mp4", description: "golden dunes, shadows moving", busyness: "calm", plate: "nature", licence: "cleared", source: "Pexels #31448827 by Anil Donoji", licenceNote: "Pexels licence: commercial use, no attribution required." },
];

/* ---- retired ------------------------------------------------------------- */

/**
 * Assets no longer offered to the generator, kept so cards already made with
 * them still render. Move entries here rather than deleting them, and leave
 * their files on disk — deleting the file is what breaks someone's saved card.
 */
export const RETIRED: LibraryAsset[] = [];

/* ---- lookup -------------------------------------------------------------- */

const ALL: LibraryAsset[] = [...MEME_TEMPLATES, ...REACTIONS];

/** Searches retired entries too: rendering must never fail because of a retirement. */
export function assetById(id: string): LibraryAsset | undefined {
  return ALL.find((a) => a.id === id) ?? RETIRED.find((a) => a.id === id);
}

export function copyFormatById(id: string): CopyFormat | undefined {
  return COPY_FORMATS.find((f) => f.id === id);
}

export function backgroundById(id: string): BackgroundClip | undefined {
  return BACKGROUNDS.find((b) => b.id === id);
}

/**
 * Stills a reaction may stand in front of.
 *
 * Empty landscape only. Anything with a person in it puts a second performer
 * behind the cut-out, and the card stops reading as one joke.
 */
export const PLATES: ReactionPlate[] = [
  { kind: "plate", id: "plate-dunes", file: "/memes/backgrounds/plate-dunes.jpg", description: "sand dunes under a clear sky", licence: "cleared", source: "Pexels #31364749 by Æmyr Sahli", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "plate", id: "plate-shore", file: "/memes/backgrounds/plate-shore.jpg", description: "gentle waves on flat sand", licence: "cleared", source: "Pexels #8877419 by Jorge Urosa", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "plate", id: "plate-sky", file: "/memes/backgrounds/plate-sky.jpg", description: "blue sky, one white cloud", licence: "cleared", source: "Pexels #36721049 by Elizabeth Ntalalai", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "plate", id: "plate-canyon", file: "/memes/backgrounds/plate-canyon.jpg", description: "red rock canyon formations", licence: "cleared", source: "Pexels #16610041 by Dimitri Baret", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "plate", id: "plate-sea", file: "/memes/backgrounds/plate-sea.jpg", description: "calm sea at dusk", licence: "cleared", source: "Pexels #37747907 by Matt Webster", licenceNote: "Pexels licence: commercial use, no attribution required." },
  { kind: "plate", id: "plate-sunset", file: "/memes/backgrounds/plate-sunset.jpg", description: "desert dunes at sundown", licence: "cleared", source: "Pexels #26925361 by Rajthilak I", licenceNote: "Pexels licence: commercial use, no attribution required." },
];

export function reactionPlates(): ReactionPlate[] {
  return PLATES;
}

/**
 * Calm footage for the text-driven formats.
 *
 * Kept separate from the plates above: a rant needs motion behind it, a
 * reaction does not.
 */
export function naturePlates(): BackgroundClip[] {
  return BACKGROUNDS.filter((b) => b.plate === "nature");
}

/**
 * Assets a new card may be built from.
 *
 * `restricted` is excluded because that is what the status means. Everything
 * else generates; `pending` is reviewed before release, not blocked during it.
 */
export function activeAssets(): LibraryAsset[] {
  return ALL.filter(
    (a) => a.licence !== "restricted" && (a.kind !== "template" || a.available),
  );
}

/** Specced but not yet usable — artwork outstanding. */
export function awaitingArtwork(): MemeTemplate[] {
  return MEME_TEMPLATES.filter((t) => !t.available);
}

/**
 * Assets that can carry this trend.
 *
 * Family is checked first: handing a two-sided trend to a single-subject asset
 * produces a card with nowhere to put the second half.
 */
export function assetsForMechanics(mechanics: TrendMechanic[]): LibraryAsset[] {
  if (!mechanics.length) return [];
  const families = new Set(mechanics.map((m) => MECHANIC_FAMILY[m]).filter(Boolean));
  return activeAssets().filter(
    (a) =>
      a.serves.some((m) => mechanics.includes(m)) &&
      a.serves.some((m) => families.has(MECHANIC_FAMILY[m])),
  );
}

export function copyFormatsForMechanics(mechanics: TrendMechanic[]): CopyFormat[] {
  return COPY_FORMATS.filter((f) => f.serves.some((m) => mechanics.includes(m)));
}

/** Everything not yet cleared. The pre-release licensing review reads this. */
export function needsLicenceReview(): Array<LibraryAsset | BackgroundClip> {
  return [...ALL, ...BACKGROUNDS].filter((a) => a.licence !== "cleared");
}
