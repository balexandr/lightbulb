import { MemoryCache } from '@/utils/memoryCache';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

const DEFAULT_MAX_TRACKED_CLIENTS = 5000;

// Fixed-window limiter, keyed by client (see utils/clientIp.ts). Backed by
// MemoryCache so the number of tracked clients is capped at
// maxTrackedClients no matter how many distinct keys get thrown at it - a
// client that spoofs a fresh identifier on every request (the exact attack
// getClientIp's own doc comment describes) evicts its own oldest fake
// entries instead of growing this process's memory without bound. Good
// enough for a single Render instance with no horizontal scaling; would
// need a shared store (Redis/KV) if this ever runs across multiple
// instances.
export class RateLimiter {
  private readonly hits: MemoryCache<RateLimitEntry>;

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    maxTrackedClients: number = DEFAULT_MAX_TRACKED_CLIENTS
  ) {
    this.hits = new MemoryCache<RateLimitEntry>(windowMs, maxTrackedClients);
  }

  check(key: string, now: number = Date.now()): RateLimitResult {
    const entry = this.hits.get(key, now);

    if (!entry) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs }, now);
      return { limited: false };
    }

    if (entry.count >= this.maxRequests) {
      return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }

    // Mutated in place, not re-written via `set()` - `set()` would reset
    // this entry's expiry to `now + windowMs`, turning the fixed window
    // into a sliding one. MemoryCache.get() returns the same object
    // reference it stores, so this mutation is visible on the next check().
    entry.count += 1;
    return { limited: false };
  }
}
