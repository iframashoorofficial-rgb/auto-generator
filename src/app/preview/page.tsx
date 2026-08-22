import { AssetView } from "@/components/AssetView";
import { EMPTY_VISUAL_META } from "@/lib/ideas";
import { imageRef, videoRef } from "@/lib/media";
import { MEME_TEMPLATES, REACTIONS, reactionPlates } from "@/lib/meme-library";
import type { ContentAsset } from "@/lib/assets";

/**
 * Every library asset, rendered.
 *
 * Not a feature — a bench. Checking that a template letterboxes, that its slots
 * land on the artwork, and that a green-screen reaction actually keys used to
 * mean generating a batch and hoping the right asset came up, which costs model
 * credits and still only covers one asset at a time. This renders all of them
 * at once through the real components, with fixed copy and no API call.
 *
 * The copy is written to the guidance in the library and sits near each slot's
 * word cap on purpose: a slot that fits its sample but not its limit is a slot
 * that will drop words in production.
 */

export const metadata = {
  title: "Library preview — every meme asset, rendered",
};

function card(
  id: string,
  slots: Record<string, string>,
  media: ReturnType<typeof imageRef>,
  reaction?: ReturnType<typeof videoRef>,
): ContentAsset {
  return {
    id,
    kind: "meme",
    angle: "meme",
    platform: "instagram",
    caption: "",
    hashtags: [],
    slides: [{ id: `${id}-0`, headline: "", mediaQuery: EMPTY_VISUAL_META, media }],
    meme: { templateId: id, slots, reaction },
    why: [],
    attrs: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

/** Sample copy per template slot, written to that slot's guidance. */
const TEMPLATE_COPY: Record<string, Record<string, string>> = {
  "drake-hotline-bling": {
    reject: "posting three times a week and hoping",
    approve: "one interview, forty posts queued",
  },
  "two-buttons": {
    option_a: "post every single day",
    option_b: "run the actual business",
    persona: "you, at 11pm",
  },
  "buff-doge-vs-cheems": {
    header: "same business, two systems",
    strong: "a brief answered once, in full",
    weak: "a brief answered forty times, badly",
  },
  "distracted-boyfriend": {
    new_thing: "another content agency",
    person: "you",
    current_thing: "the £600 photo folder",
  },
  "this-is-fine": {
    disaster: "last post was 14 march",
    persona: "the founder",
  },
};

/** Sample copy per reaction setup slot. */
const REACTION_COPY: Record<string, Record<string, string>> = {
  "serious-baby": {
    claim: "we'll batch a whole month of content on sunday, easy",
  },
  "thought-i-was-stronger": {
    state: "three posts a week, scheduled, ahead of myself",
    trigger: "monday",
  },
  crying: {
    claim: "i genuinely love making content for my own business",
  },
  "shia-clapping": {
    situation: "someone who is not my mum commented on the post",
  },
  "cat-happy": {
    expectation: "a forty field brief and two onboarding calls",
    outcome: "six questions, answered once",
  },
};

export default function Preview() {
  const templates = MEME_TEMPLATES.map((t) =>
    card(t.id, TEMPLATE_COPY[t.id] ?? {}, imageRef(t.file, "stock", t.name)),
  );

  // Each reaction gets a different plate, cycled, so a failure is obviously the
  // reaction and not the thing behind it.
  const plates = reactionPlates();
  const reactions = REACTIONS.map((r, i) =>
    card(
      r.id,
      REACTION_COPY[r.id] ?? {},
      imageRef(plates[i % plates.length].file, "stock", plates[i % plates.length].description),
      videoRef(r.file, undefined, "stock"),
    ),
  );

  return (
    <main className="shell">
      <header className="top">
        <p className="eyebrow">Rendering bench</p>
        <h1>Every meme asset, rendered</h1>
        <p className="lede">
          Fixed copy, no model call. Templates should show whole — letterboxed,
          never cropped — with every label on the artwork. Reactions should show
          the subject with the green gone, over moving footage.
        </p>
      </header>

      <section aria-labelledby="templates-heading">
        <h2 id="templates-heading" className="eyebrow">
          Templates
        </h2>
        <div className="benchGrid">
          {templates.map((a) => (
            <figure className="bench" key={a.id}>
              <div className="ideaCard">
                <div className="ideaMedia">
                  <AssetView asset={a} active />
                </div>
              </div>
              <figcaption>{a.id}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="reactions-heading" style={{ marginTop: 34 }}>
        <h2 id="reactions-heading" className="eyebrow">
          Reactions
        </h2>
        <div className="benchGrid">
          {reactions.map((a) => (
            <figure className="bench" key={a.id}>
              <div className="ideaCard">
                <div className="ideaMedia">
                  <AssetView asset={a} active />
                </div>
              </div>
              <figcaption>{a.id}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
