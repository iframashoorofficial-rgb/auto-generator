/**
 * Live trend research.
 *
 * Replaces a hand-typed array that was stamped with a date and went stale the
 * moment nobody remembered to edit it. Trend roundup pages are fetched, read,
 * and distilled by a cheap model into records the matcher can use.
 *
 * Degrades to nothing, deliberately. If the fetch fails, the key is missing or
 * the distil returns junk, `getTrends` yields an empty list and the generator
 * falls back to evergreen post patterns. There is no stale array to fall back
 * to any more, and inventing one would put us back where we started.
 */

import { chat, parseJsonLoose, FAST_MODEL } from "./openrouter";
import { extractText } from "./html-text";
import { MECHANIC_FAMILY, type TrendMechanic } from "./meme-library";

export interface Trend {
  id: string;
  label: string;
  /** How the format works, handed to the writer verbatim. */
  shape: string;
  /** Why it is landing right now. */
  note: string;
  /**
   * Which library assets can carry it. The join is on mechanic rather than
   * name because trend names churn weekly and a name-based library would be
   * stale within a fortnight.
   */
  mechanics: TrendMechanic[];
  /** Whether it can be told with a still, a clip, or plain copy. */
  medium: "meme-image" | "video" | "generic";
}

/**
 * Sources. Chosen because they publish dated roundups and are plain HTML.
 *
 * TikTok, Reddit and X are all unreadable from a server — TikTok returns an
 * empty JS shell, Reddit blocks, X wants a login — so these secondary roundups
 * are the practical route without adding a paid search API.
 */
const SOURCES = [
  "https://www.socialpilot.co/blog/tiktok-trends",
  "https://newengen.com/insights/instagram-trends/",
  "https://knowyourmeme.com/newsfeed/trending",
];

/** Long enough that a click never waits on a scrape, short enough to stay current. */
const TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;
/** Keep the distil prompt small — this runs inside a 60s route budget. */
const CHARS_PER_SOURCE = 6000;

interface Cache {
  at: number;
  trends: Trend[];
}

/**
 * In-memory, per-instance.
 *
 * Same trade-off as rate-limit.ts: serverless instances do not share memory, so
 * the worst case is each instance scraping once per TTL. That is a handful of
 * requests a day, not a problem worth a KV store.
 */
let cache: Cache | null = null;
/** Collapses concurrent misses into one scrape instead of three. */
let inflight: Promise<Trend[]> | null = null;

async function fetchSource(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FormatStudio/1.0)" },
    });
    if (!res.ok) return "";
    return extractText(await res.text(), CHARS_PER_SOURCE).text;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

const MECHANICS = Object.keys(MECHANIC_FAMILY) as TrendMechanic[];

const SYSTEM = `You read social-media trend roundups and extract the FORMATS behind them.

You are not summarising articles. You are identifying reusable joke structures a
brand could adapt without copying anyone's post.

Rules:
- Extract the MECHANIC, never the specific joke, celebrity or sound.
- Reject anything that needs choreography, a specific licensed track, or a
  person performing to camera. This product lays text over stock footage and
  cannot film anyone.
- If a roundup is vague about how a format actually works, leave it out. A
  guessed mechanic is worse than one fewer trend.
- Output JSON only.`;

function distilPrompt(corpus: string): string {
  return `Below is text scraped from social-media trend roundups.

Extract up to 8 distinct formats. For each, return:
  id       short kebab-case slug
  label    a human name
  shape    HOW to build it, concretely, in one or two sentences
  note     why it is working right now
  mechanics  one or more of: ${MECHANICS.join(", ")}
  medium   "meme-image" (works as a still with text), "video" (needs motion),
           or "generic" (works as plain copy)

Return {"trends": [...]} and nothing else.

---
${corpus}`;
}

function coerce(raw: unknown): Trend[] {
  const list = Array.isArray((raw as { trends?: unknown[] })?.trends)
    ? ((raw as { trends: unknown[] }).trends as Record<string, unknown>[])
    : [];

  const out: Trend[] = [];
  for (const t of list) {
    const id = String(t.id ?? "").trim();
    const shape = String(t.shape ?? "").trim();
    if (!id || !shape) continue;

    // Drop unknown mechanic names rather than trusting the model's vocabulary:
    // an unrecognised value would silently match nothing later.
    const mechanics = (Array.isArray(t.mechanics) ? t.mechanics : [])
      .map((m) => String(m).trim() as TrendMechanic)
      .filter((m) => MECHANICS.includes(m));
    if (!mechanics.length) continue;

    const medium = t.medium === "meme-image" || t.medium === "video" ? t.medium : "generic";

    out.push({
      id,
      label: String(t.label ?? id).trim(),
      shape,
      note: String(t.note ?? "").trim(),
      mechanics,
      medium,
    });
  }
  return out;
}

async function research(): Promise<Trend[]> {
  const pages = await Promise.all(SOURCES.map(fetchSource));
  const corpus = pages.filter(Boolean).join("\n\n---\n\n").trim();
  if (!corpus) return [];

  try {
    const raw = await chat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: distilPrompt(corpus) },
      ],
      { json: true, model: FAST_MODEL, temperature: 0.4, maxTokens: 2000 },
    );
    return coerce(parseJsonLoose(raw));
  } catch {
    // A missing key or a bad upstream must not take the whole route down.
    return [];
  }
}

/** Cached trend list. Empty is a valid answer and callers must handle it. */
export async function getTrends(): Promise<Trend[]> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.trends;
  if (inflight) return inflight;

  inflight = research()
    .then((trends) => {
      // Cache empties too, briefly, so a broken source does not mean scraping
      // three pages on every single request.
      cache = { at: Date.now(), trends };
      return trends;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Test seam, and lets a deploy start from cold deliberately. */
export function clearTrendCache(): void {
  cache = null;
}
