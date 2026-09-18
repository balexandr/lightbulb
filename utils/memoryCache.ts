interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Simple in-process TTL cache, shared across every request the server
// handles (not per-user). Good enough for a single Render instance with no
// horizontal scaling - same tradeoff as utils/rateLimiter.ts, and it resets
// on every deploy/restart/spin-down. That's an acceptable loss for a
// low-traffic app: if the instance spun down, nobody was using it, so
// there's no meaningful cache to lose. Upgrade to Redis/KV (§15.6) if
// traffic grows enough that restart amnesia starts costing real money.
export class MemoryCache<T> {
  private store = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number
  ) {}

  get(key: string, now: number = Date.now()): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (now >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    // Delete-then-set so re-caching an existing key also refreshes its
    // position for the FIFO eviction below.
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: now + this.ttlMs });
    this.evictOldestIfOverCapacity();
  }

  private evictOldestIfOverCapacity(): void {
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.store.delete(oldestKey);
    }
  }
}
