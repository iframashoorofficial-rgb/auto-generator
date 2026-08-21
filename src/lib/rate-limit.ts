/**
 * Rate limiting.
 *
 * Image generation is the one endpoint that spends real money per call — a few
 * cents each — and it is public and unauthenticated. This guards the bill.
 *
 * Deliberately in-memory: the app has no database or KV store, and adding one
 * purely for this would be new infrastructure rather than a small change.
 *
 * KNOWN LIMIT: serverless instances do not share memory, so on Vercel the
 * effective ceiling is per-instance rather than global. That stops a naive
 * loop from one client — the realistic threat — but a distributed attacker
 * could still exceed it. Moving the two maps below into Vercel KV is the
 * upgrade path when it is worth the infrastructure; nothing else changes.
 */

export interface RateLimitRule {
  /** Requests allowed per window, per caller. */
  perCaller: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Requests allowed per window across all callers — a spend ceiling. */
  global: number;
}

/** Roughly $0.04 per image: 8 per 10 min per caller, 60/hour overall. */
export const IMAGE_LIMIT: RateLimitRule = {
  perCaller: Number(process.env.IMAGE_LIMIT_PER_CALLER) || 8,
  windowMs: Number(process.env.IMAGE_LIMIT_WINDOW_MS) || 10 * 60_000,
  global: Number(process.env.IMAGE_LIMIT_GLOBAL) || 60,
};

/** Timestamps of recent hits, newest last. */
const callers = new Map<string, number[]>();
const globalHits: number[] = [];

/**
 * Drop timestamps that have aged out of the window, mutating in place.
 *
 * In place on purpose: an earlier version returned a copy, and because it
 * returned the *same* array when nothing had expired, clearing the original
 * also cleared the "copy" — silently disabling the global cap.
 */
function prune(list: number[], since: number): number[] {
  let i = 0;
  while (i < list.length && list[i] <= since) i++;
  if (i) list.splice(0, i);
  return list;
}

/**
 * Identify the caller.
 *
 * `x-forwarded-for` is set by Vercel's proxy and is the only signal available
 * without accounts. It is spoofable, which is another reason the global cap
 * exists alongside the per-caller one.
 */
export function callerKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim();
  return ip || req.headers.get("x-real-ip") || "unknown";
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may retry. Only meaningful when blocked. */
  retryAfter: number;
  remaining: number;
  /** Which ceiling was hit, for the message shown to the user. */
  scope: "caller" | "global" | null;
}

export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult {
  const since = now - rule.windowMs;

  // Global ceiling first: it protects spend even if callers rotate.
  prune(globalHits, since);
  if (globalHits.length >= rule.global) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((globalHits[0] + rule.windowMs - now) / 1000)),
      remaining: 0,
      scope: "global",
    };
  }

  const recent = prune(callers.get(key) ?? [], since);
  if (recent.length >= rule.perCaller) {
    callers.set(key, recent);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((recent[0] + rule.windowMs - now) / 1000)),
      remaining: 0,
      scope: "caller",
    };
  }

  recent.push(now);
  callers.set(key, recent);
  globalHits.push(now);

  // Keep the map from growing without bound on a long-lived instance.
  if (callers.size > 5000) {
    for (const [k, v] of callers) {
      if (!v.length || v[v.length - 1] <= since) callers.delete(k);
    }
  }

  return {
    ok: true,
    retryAfter: 0,
    remaining: rule.perCaller - recent.length,
    scope: null,
  };
}

/** Test seam — lets a test start from a clean slate. */
export function resetRateLimit() {
  callers.clear();
  globalHits.length = 0;
}
