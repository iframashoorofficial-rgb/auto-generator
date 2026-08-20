import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import {
  EMPTY_PROFILE,
  mergeProfile,
  missingFields,
  profileSummary,
  type BusinessProfile,
} from "@/lib/profile";
import { getFormat } from "@/lib/formats";

export const runtime = "nodejs";

interface IntakeRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  profile?: BusinessProfile;
  formatId?: string;
}

interface AgentReply {
  reply: string;
  profile?: Partial<BusinessProfile>;
  ready?: boolean;
}

/**
 * The intake agent. Its job is to understand the business, not to fill in a
 * form for one format — the format only contributes extra things to find out.
 */
function systemPrompt(formatId: string | undefined, profile: BusinessProfile): string {
  const format = formatId ? getFormat(formatId) : null;
  const known = profileSummary(profile);
  const gaps = missingFields(profile);

  return [
    "You are interviewing a business owner so their marketing can be written accurately.",
    "",
    "How to behave:",
    "- Ask ONE question at a time. Short, plain, no jargon, no preamble.",
    "- Follow up on vague answers. 'We're better' is not an answer; ask how, specifically.",
    "- Chase concrete, checkable detail: real steps, real channels, real timeframes.",
    "- Never invent facts about the business. If they haven't said it, it isn't true yet.",
    "- If they say something that must never be claimed, record it under 'avoid'.",
    "- When you have enough to write honest marketing, set ready to true and stop asking.",
    "",
    "You are building this profile:",
    "name, offering, audience, problem, alternative, edge, proof[], voice, callToAction, avoid[], sector",
    "",
    known ? `Already known:\n${known}` : "Nothing known yet — start by asking what the business is called and what it does.",
    "",
    gaps.length ? `Still missing: ${gaps.join(", ")}` : "All required fields are filled. Probe for proof and voice, then finish.",
    "",
    format
      ? `They intend to produce: ${format.name} — ${format.description}\nFor this you also need:\n${format.intakeGoals.map((g) => `- ${g}`).join("\n")}`
      : "",
    "",
    "Reply with JSON only, no prose outside it:",
    '{"reply": "your next question or closing remark", "profile": {fields you learned this turn}, "ready": boolean}',
    "Only include profile fields you actually learned from their latest message.",
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

  const profile = body.profile ?? EMPTY_PROFILE;
  const history = Array.isArray(body.messages) ? body.messages.slice(-20) : [];

  try {
    const raw = await chat(
      [
        { role: "system", content: systemPrompt(body.formatId, profile) },
        ...history.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content ?? ""),
        })),
      ],
      { json: true, temperature: 0.6, maxTokens: 700 },
    );

    const parsed = parseJsonLoose<AgentReply>(raw);
    if (!parsed?.reply) {
      // The model answered in prose. Use it rather than erroring at the user.
      return NextResponse.json({ reply: raw.trim(), profile, ready: false });
    }

    const nextProfile = mergeProfile(profile, parsed.profile);
    const ready = Boolean(parsed.ready) && missingFields(nextProfile).length === 0;

    return NextResponse.json({ reply: parsed.reply, profile: nextProfile, ready });
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
