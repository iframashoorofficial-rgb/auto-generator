import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import { missingFields, profileSummary } from "@/lib/profile";
import {
  EMPTY_BRAND,
  brandProgress,
  brandSummary,
  mergeBrand,
  missingBrandFields,
  normalizePatch,
  type BrandProfile,
} from "@/lib/brand";
import { getFormat } from "@/lib/formats";
import type { ChatMode } from "@/lib/chat-types";

export const runtime = "nodejs";

interface IntakeRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  brand?: BrandProfile;
  formatId?: string;
}

/** What the agent may change in one turn. */
interface AgentReply {
  reply: string;
  brand?: Partial<BrandProfile>;
  ready?: boolean;
  /** Set when the agent wants the website read before continuing. */
  researchUrl?: string;
  /** Set when the agent is asking the user to confirm researched data. */
  awaitingConfirmation?: boolean;
}

/**
 * Onboarding agent.
 *
 * Two rules distinguish it from a generic interviewer: the opening question is
 * fixed, and it must not ask about anything already known — research fills a
 * lot of the profile in one shot, and re-asking makes the product feel deaf.
 */
function onboardingPrompt(brand: BrandProfile, formatId?: string): string {
  const format = formatId ? getFormat(formatId) : null;
  const known = [profileSummary(brand.business), brandSummary(brand)]
    .filter(Boolean)
    .join("\n");
  const gaps = missingBrandFields(brand).map((f) => f.label);
  const hasName = brand.business.name.trim().length > 0;

  return [
    "You are onboarding a brand for a social-media studio. You are gathering knowledge once so every future carousel can use it.",
    "",
    "Sequence:",
    hasName
      ? "- The brand name is known."
      : '- Your FIRST question must be exactly: "What\'s the name of your brand?" Nothing before it, nothing after it.',
    "- Once you know the name, ask for their website so it can be read automatically.",
    "- When they give you a URL: set researchUrl to it, and make your reply say you are reading it now. Never re-ask for a website they just gave you.",
    "- If they say they have no website, say that is fine and ask what the brand does instead.",
    "- If the brand could be several different companies, ask for the website rather than guessing.",
    "- After research runs, show what was found and ask them to confirm it is right. Set awaitingConfirmation true.",
    "- Treat researched data as provisional until they confirm it.",
    '- The moment they confirm it is the right brand ("yes", "that\'s us", or a correction), set brand.confirmed to true.',
    "",
    "How to behave:",
    "- ONE question at a time. Short, plain, no preamble, no jargon.",
    "- NEVER ask about something already listed as known below. Ask only for what is missing, uncertain or subjective.",
    "- Subjective things (tone, goals, who they want to reach next) must come from them, never from the website.",
    "- Never invent facts. If they have not said it and the site did not say it, it is not true.",
    "- When everything required is captured, set ready true and say so warmly in one line.",
    "",
    "You are filling this brand record:",
    "business{name, offering, audience, problem, alternative, edge, proof[], voice, callToAction, avoid[], sector}",
    "website, positioning, contentGoals[], platforms[], visual{aesthetic, palette[], photography, lighting, composition, mood, realism, texture, recurring, avoid[]}",
    "",
    known ? `ALREADY KNOWN — do not ask about these:\n${known}` : "Nothing known yet.",
    "",
    gaps.length
      ? `Still needed: ${gaps.join(", ")}`
      : "Everything required is present. Confirm and finish.",
    "",
    format
      ? `They will produce: ${format.name} — ${format.description}\nAlso worth learning:\n${format.intakeGoals.map((g) => `- ${g}`).join("\n")}`
      : "",
    "",
    "Reply with JSON only:",
    '{"reply": "...", "brand": {"business": {"name": "..."}, "positioning": "..."}, "researchUrl": "https://... or omit", "awaitingConfirmation": boolean, "ready": boolean}',
    'Brand fields MUST be nested exactly as shown: name/offering/audience/problem/alternative/edge/proof/voice/callToAction/avoid/sector go inside "business". Include only what you learned this turn.',
    'The moment they tell you the brand name, put it in business.name — do not wait.',
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Post-onboarding agent.
 *
 * Same thread, different job: it now maintains the brand record. "Make our
 * tone more playful" is an edit, not a conversation, so it should apply the
 * change and say what it changed.
 */
function assistantPrompt(brand: BrandProfile): string {
  return [
    "You are this brand's ongoing social-media strategist. Onboarding is done; you now maintain what is known about them.",
    "",
    "How to behave:",
    "- When they state a change — a new audience, a different tone, a new goal, a visual direction — apply it to the brand record and confirm in one short line what you changed.",
    "- Quote the new value back so they can see it took effect.",
    "- When they ask for advice or ideas, answer as a strategist who already knows this brand. Be specific, never generic.",
    "- If they ask for carousel ideas, return them in queueIdeas rather than only as prose.",
    "- Never wipe a known value unless they clearly want it removed.",
    "",
    "The brand record you maintain:",
    brandSummary(brand) || "(sparse)",
    "",
    profileSummary(brand.business),
    "",
    "Reply with JSON only:",
    '{"reply": "...", "brand": {fields you changed}, "queueIdeas": [{"title": "...", "angle": "...", "formatId": "comparison-carousel|proof-drop"}]}',
    "Include queueIdeas only when they asked for ideas.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: Request) {
  let body: IntakeRequest;
  try {
    body = (await req.json()) as IntakeRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const brand = mergeBrand(EMPTY_BRAND, body.brand);
  const history = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  const mode: ChatMode = brand.onboarded ? "assistant" : "onboarding";

  const system =
    mode === "onboarding"
      ? onboardingPrompt(brand, body.formatId)
      : assistantPrompt(brand);

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        ...history.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content ?? ""),
        })),
      ],
      { json: true, temperature: 0.6, maxTokens: 900 },
    );

    const parsed = parseJsonLoose<AgentReply & { queueIdeas?: unknown[] }>(raw);
    if (!parsed?.reply) {
      // The model answered in prose instead of JSON. Use the text rather than
      // erroring, but keep the response shape identical so the client never
      // sees a half-populated turn.
      return NextResponse.json({
        reply: raw.trim(),
        brand,
        ready: false,
        mode,
        progress: brandProgress(brand),
        researchUrl: null,
        awaitingConfirmation: false,
        queueIdeas: [],
      });
    }

    let nextBrand = mergeBrand(brand, normalizePatch(parsed.brand));

    // Confirmation only exists to guard against trusting the wrong website.
    // When nothing was researched, the user's own words are self-confirming —
    // without this the progress bar could never reach 100 and onboarding
    // would deadlock waiting for a confirmation that is never asked for.
    if (
      !nextBrand.confirmed &&
      !nextBrand.researched &&
      nextBrand.business.name.trim() &&
      nextBrand.business.offering.trim()
    ) {
      nextBrand = { ...nextBrand, confirmed: true };
    }

    // `ready` is the agent's opinion; the field checks are the fact. Requiring
    // both stops a chatty model unlocking on a half-built profile, and the UI
    // separately unlocks on progress so nobody can be trapped.
    const ready =
      mode === "assistant"
        ? true
        : Boolean(parsed.ready) &&
          missingFields(nextBrand.business).length === 0 &&
          brandProgress(nextBrand) === 100;

    return NextResponse.json({
      reply: parsed.reply,
      brand: nextBrand,
      ready,
      mode,
      progress: brandProgress(nextBrand),
      researchUrl: parsed.researchUrl ?? null,
      awaitingConfirmation: Boolean(parsed.awaitingConfirmation),
      queueIdeas: Array.isArray(parsed.queueIdeas) ? parsed.queueIdeas : [],
    });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json(
        { error: "No OpenRouter key. Add OPENROUTER_API_KEY to .env.local and restart." },
        { status: 503 },
      );
    }
    if (err instanceof UpstreamError) {
      return NextResponse.json(
        { error: `OpenRouter refused the request (${err.status}). ${err.message}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ error: "Could not reach the model." }, { status: 500 });
  }
}
