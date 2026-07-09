// Sliding-window limiter held in module memory. Serverless caveat: each warm
// lambda instance has its own window, so the effective global limit is
// LIMIT × concurrent instances — good enough to deter casual abuse of a free
// tool. For a hard global limit, swap this for a shared store (e.g. Upstash
// Redis + @upstash/ratelimit) without changing the call site.

const WINDOW_MS = 60_000;
const LIMIT = 20;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= LIMIT) {
    hits.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 10_000) {
    for (const [k, timestamps] of hits) {
      if (timestamps.every((t) => t <= windowStart)) hits.delete(k);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}
