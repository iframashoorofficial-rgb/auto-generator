import { NextResponse } from "next/server";
import { createHash } from "crypto";

/**
 * TEMPORARY diagnostic. Reports the *shape* of the configured key so a broken
 * value can be told apart from a missing one. Never returns the key itself —
 * only a truncated hash, which is not reversible. Delete once the env var is
 * confirmed working.
 */
export async function GET() {
  const raw = process.env.OPENROUTER_API_KEY;

  if (raw === undefined) {
    return NextResponse.json({ present: false, note: "env var not set at all" });
  }

  const trimmed = raw.trim();
  return NextResponse.json({
    present: true,
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hasLeadingOrTrailingWhitespace: raw !== trimmed,
    hasInnerWhitespace: /\s/.test(trimmed),
    hasQuotes: /^["']|["']$/.test(trimmed),
    startsWithSkOrV1: trimmed.startsWith("sk-or-v1-"),
    firstCharCode: raw.charCodeAt(0),
    lastCharCode: raw.charCodeAt(raw.length - 1),
    // First 8 hex of sha256 — enough to compare against the local key, useless
    // to anyone else.
    fingerprint: createHash("sha256").update(trimmed).digest("hex").slice(0, 8),
    modelConfigured: process.env.OPENROUTER_MODEL ?? "(unset - using default)",
  });
}
