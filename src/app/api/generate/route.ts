import { NextResponse } from "next/server";
import { chat, parseJsonLoose, MissingKeyError, UpstreamError } from "@/lib/openrouter";
import { EMPTY_PROFILE, profileSummary, type BusinessProfile } from "@/lib/profile";
import { getFormat } from "@/lib/formats";

export const runtime = "nodejs";

interface GenerateRequest {
  formatId: string;
  profile: BusinessProfile;
  /** Bumped by Regenerate so the model takes a different angle. */
  attempt?: number;
  /** Free-text steer from the user, e.g. "funnier", "lead with price". */
  steer?: string;
}

export async function POST(req: Request) {
  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const format = getFormat(body.formatId);
  const profile = body.profile ?? EMPTY_PROFILE;
  const attempt = Number(body.attempt) || 0;

  const slotSpec = format.slots
    .map((s) => `- ${s.key}: ${s.intent} (max ~${s.max} characters)`)
    .join("\n");

  const frameSpec = format.frames
    .map((f, i) => `Frame ${i + 1} — ${f.role}: ${f.purpose}`)
    .join("\n");

  const system = [
    `You write copy for a ${format.name}: ${format.description}`,
    `Narrative shape: ${format.beats}`,
    "",
    "Frames:",
    frameSpec,
    "",
    "Fill exactly these slots:",
    slotSpec,
    "",
    "Rules:",
    ...format.writingRules.map((r) => `- ${r}`),
    "- Every line is set in large display type. Short beats clever. Never pad to fill.",
    "- Use ONLY facts present in the business profile. Invent nothing — no statistics,",
    "  no prices, no capabilities, no timeframes that were not stated.",
    "- Match the stated voice. If none was given, write plainly.",
    "- Respect anything listed under 'never claim'.",
    "",
    attempt > 0
      ? `This is regeneration #${attempt}. Take a genuinely different angle from the obvious one — different entry point, different emphasis. Do not merely reword.`
      : "",
    body.steer ? `The user asked for: ${body.steer}` : "",
    "",
    "Reply with JSON only: an object whose keys are exactly the slot keys above and whose values are strings.",
  ]
    .filter(Boolean)
    .join("\n");

  const user = [
    "Business profile:",
    profileSummary(profile) || "(empty — say so rather than inventing one)",
  ].join("\n");

  try {
    const raw = await chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, temperature: attempt > 0 ? 0.95 : 0.8, maxTokens: 900 },
    );

    const parsed = parseJsonLoose<Record<string, unknown>>(raw);
    if (!parsed) {
      return NextResponse.json(
        { error: "The model did not return usable JSON. Try Regenerate." },
        { status: 502 },
      );
    }

    // Keep only known slots, coerce to trimmed strings, and never drop a key —
    // the renderer expects every slot to exist.
    const slots: Record<string, string> = {};
    for (const slot of format.slots) {
      const v = parsed[slot.key];
      slots[slot.key] = typeof v === "string" ? v.trim() : "";
    }

    return NextResponse.json({ slots });
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
