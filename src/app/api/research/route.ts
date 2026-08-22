import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import { EMPTY_PROFILE, type BusinessProfile } from "@/lib/profile";
import type { VisualDNA } from "@/lib/brand";

import { extractText } from "@/lib/html-text";

export const runtime = "nodejs";

/**
 * Brand research.
 *
 * Reads the brand's own website and prefills what it can, so onboarding only
 * has to ask for what is missing, uncertain or subjective. The page is fetched
 * server-side — a browser could not, because of CORS.
 *
 * Nothing here is treated as final: the response carries a `confidence` and a
 * `summary` the user is asked to confirm before the data is trusted.
 */

interface ResearchRequest {
  brandName: string;
  url: string;
}

interface ResearchReply {
  /** The brand name as the site actually states it. */
  detectedName: string;
  /** One paragraph the user can confirm or correct. */
  summary: string;
  confidence: "high" | "medium" | "low";
  business: Partial<BusinessProfile>;
  positioning: string;
  contentGoals: string[];
  platforms: string[];
  visual: Partial<VisualDNA>;
  /** What the site did not reveal — onboarding asks about these. */
  stillUnknown: string[];
}

const MAX_CHARS = 14000;

/** Normalise whatever the user typed into something fetchable. */
function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    // Block anything that is not a public web page.
    if (!/^https?:$/.test(u.protocol)) return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(u.hostname)) {
      return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: ResearchRequest;
  try {
    body = (await req.json()) as ResearchRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const url = normaliseUrl(body.url ?? "");
  if (!url) {
    return NextResponse.json(
      { error: "That does not look like a public website address." },
      { status: 400 },
    );
  }

  // --- fetch the page -----------------------------------------------------
  let html: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        // Some sites serve a blank shell to unknown agents.
        "User-Agent":
          "Mozilla/5.0 (compatible; FormatStudio/1.0; +https://openrouter.ai)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `The site returned ${res.status}. Check the address, or tell me about the brand instead.` },
        { status: 502 },
      );
    }
    html = await res.text();
  } catch {
    return NextResponse.json(
      { error: "Could not reach that site. Check the address, or tell me about the brand instead." },
      { status: 502 },
    );
  }

  const { text } = extractText(html);
  if (text.length < 120) {
    return NextResponse.json(
      { error: "That page had almost no readable text — it may be JavaScript-only. Tell me about the brand instead." },
      { status: 422 },
    );
  }

  // --- read it ------------------------------------------------------------
  const system = [
    "You are researching a brand from its own website so an onboarding interview can skip questions it already knows the answer to.",
    "Extract only what the page actually supports. Never invent a statistic, a client name or a claim.",
    "Leave a field as an empty string when the page does not tell you.",
    "For visual style, describe what the site's own imagery and design suggest — palette, photography, mood.",
    "",
    "Reply as JSON only:",
    JSON.stringify(
      {
        detectedName: "the brand name as the site states it",
        summary: "2-3 sentences the owner could confirm or correct",
        confidence: "high | medium | low",
        business: {
          name: "", offering: "", audience: "", problem: "",
          alternative: "", edge: "", proof: [], voice: "",
          callToAction: "", avoid: [], sector: "",
        },
        positioning: "",
        contentGoals: [],
        platforms: [],
        visual: {
          aesthetic: "", palette: [], photography: "", lighting: "",
          composition: "", mood: "", realism: "", texture: "",
          recurring: "", avoid: [],
        },
        stillUnknown: ["fields a human must answer"],
      },
      null,
      1,
    ),
  ].join("\n");

  const user = [
    body.brandName ? `The user says the brand is called: ${body.brandName}` : "",
    `Website: ${url}`,
    "",
    "Page content:",
    text,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, maxTokens: 1800, temperature: 0.2 },
    );

    const parsed = parseJsonLoose<ResearchReply>(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not make sense of that site." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url,
      detectedName: parsed.detectedName || body.brandName || "",
      summary: parsed.summary || "",
      confidence: parsed.confidence || "low",
      business: { ...EMPTY_PROFILE, ...(parsed.business ?? {}) },
      positioning: parsed.positioning || "",
      contentGoals: parsed.contentGoals ?? [],
      platforms: parsed.platforms ?? [],
      visual: parsed.visual ?? {},
      stillUnknown: parsed.stillUnknown ?? [],
    });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        { error: "No OpenRouter key. Add OPENROUTER_API_KEY and restart." },
        { status: 503 },
      );
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json(
        { error: `The model refused the request (${err.status}).` },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Research failed." }, { status: 500 });
  }
}
