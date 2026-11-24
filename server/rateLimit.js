// Fixed-window, in-memory rate limiter keyed by client (e.g. IP address).
//
// Note: on serverless platforms each warm instance has its own memory, so this
// is a best-effort guard against casual abuse, not a global quota. For a hard
// cap, also set a monthly spend limit in each provider's console.
export function createRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map(); // key -> { count, resetAt }

  return function check(key) {
    const t = now();

    // Drop expired entries so the map can't grow without bound.
    if (hits.size > 10_000) {
      for (const [k, entry] of hits) if (entry.resetAt <= t) hits.delete(k);
    }

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - t) / 1000) };
    }
    return { allowed: true, remaining: max - entry.count };
  };
}

// First address in x-forwarded-for is the original client on Vercel.
export function clientKey(headers = {}) {
  const forwarded = headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first && first.split(",")[0].trim()) || headers["x-real-ip"] || "unknown";
}
