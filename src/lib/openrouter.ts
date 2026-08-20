/**
 * Minimal OpenRouter client.
 *
 * OpenRouter speaks the OpenAI chat-completions shape, so this is a thin fetch
 * wrapper rather than a dependency. The key stays on the server — it is read
 * from the environment and never sent to the browser.
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_MODEL =
  process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class MissingKeyError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not set");
    this.name = "MissingKeyError";
  }
}

export class UpstreamError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new MissingKeyError();

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages,
    max_tokens: opts.maxTokens ?? 1400,
    temperature: opts.temperature ?? 0.7,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // OpenRouter uses these for attribution on its dashboard.
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:3000",
      "X-Title": "Format Studio",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError(res.status, detail.slice(0, 500) || res.statusText);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new UpstreamError(502, "No content returned by the model");
  return text;
}

/**
 * Models sometimes wrap JSON in prose or a fenced block even when asked not
 * to. Pull the first balanced object out rather than failing the request.
 */
export function parseJsonLoose<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // fall through
  }

  const start = candidate.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(candidate.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
