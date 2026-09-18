interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

// Simple in-memory fixed-window limiter. Good enough for a single Render
// instance with no horizontal scaling; would need a shared store (Redis/KV)
// if this ever runs across multiple instances.
export class RateLimiter {
  private hits = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(key: string, now: number = Date.now()): RateLimitResult {
    this.sweepExpired(now);

    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { limited: false };
    }

    if (entry.count >= this.maxRequests) {
      return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }

    entry.count += 1;
    return { limited: false };
  }

  // Only sweep once the map has grown large enough that an O(n) pass is
  // worth it - avoids paying that cost on every single request.
  private sweepExpired(now: number): void {
    if (this.hits.size < 500) {
      return;
    }
    for (const [key, entry] of this.hits) {
      if (now >= entry.resetAt) {
        this.hits.delete(key);
      }
    }
  }
}
