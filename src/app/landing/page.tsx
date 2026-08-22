import Link from "next/link";
import { MemeReel, type Meme } from "@/components/MemeReel";

export const metadata = {
  title: "Format Studio — interview once, post for months",
  description:
    "Answer six questions about your business. Get finished posts back, in any format, for as long as you need them.",
};

/**
 * The three reels.
 *
 * Written with the meme-engine skill: format first, then slots. Every line
 * carries at least two concrete anchors, and none of them names what is on
 * screen — the footage and the caption are meant to disagree.
 *
 * The first two are the "how different our lives are" split, where the strict
 * grammatical parallel is the whole joke. The third is the saxophone format:
 * a flat setup that sits there, then a tag that arrives too late to help.
 */
const REELS: Meme[] = [
  {
    id: "idea-drought",
    stamp: "7am monday",
    clips: [
      { src: "/memes/drought-me.mp4", caption: "googling 30 content ideas" },
      { src: "/memes/drought-her.mp4", caption: "binning 30 in 2 minutes" },
    ],
  },
  {
    id: "onboarding",
    stamp: "day 1",
    clips: [
      { src: "/memes/brief-me.mp4", caption: "filling a 40 field brief" },
      { src: "/memes/brief-her.mp4", caption: "answering 6 questions once" },
    ],
  },
  {
    id: "dead-grid",
    stamp: "last post was 14 march",
    clips: [{ src: "/memes/empty-office.mp4", caption: "" }],
    tag: "and the saxophones get louder",
  },
];

export default function Landing() {
  return (
    <main className="shell">
      <header className="top">
        <p className="eyebrow">Format Studio</p>
        <h1>Interview your business once. Post for months.</h1>
        <p className="lede">
          Six questions, answered one time. After that every format — carousels,
          proof drops, whatever comes next — writes itself from the same profile,
          because nothing in the interview was shaped around a particular layout.
        </p>
      </header>

      <section aria-labelledby="reels-heading" style={{ marginBottom: 40 }}>
        <h2 id="reels-heading" className="eyebrow" style={{ marginBottom: 18 }}>
          What it replaces
        </h2>
        <div className="reelGrid">
          {REELS.map((meme) => (
            <MemeReel key={meme.id} meme={meme} />
          ))}
        </div>
        <p className="reelNote">
          <strong>Silent on purpose.</strong> These formats run on trending audio
          that TikTok and Reels licence for posts made there — that licence does
          not cover a self-hosted page, so the text carries them here. Footage
          from Pexels, licensed for commercial use; see{" "}
          <code>public/memes/CREDITS.txt</code>.
        </p>
      </section>

      <p>
        <Link href="/">Open the studio →</Link>
      </p>
    </main>
  );
}
