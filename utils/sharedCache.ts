import { Redis } from '@upstash/redis';

import { MemoryCache } from '@/utils/memoryCache';

// Plain console, not utils/logger.ts - that module gates on __DEV__, a
// Metro/RN client global not guaranteed to exist in this route's server
// bundle, and this needs to log correctly in a plain Node/Render context.

export interface SharedCache<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
}

// Falls back to this when Upstash isn't configured (e.g. local dev without
// the env vars set) - same in-memory tradeoff as before: resets on
// restart/spin-down, fine for low traffic, see utils/memoryCache.ts.
class InMemorySharedCache<T> implements SharedCache<T> {
  private cache: MemoryCache<T>;

  constructor(ttlMs: number, maxEntries: number) {
    this.cache = new MemoryCache<T>(ttlMs, maxEntries);
  }

  async get(key: string): Promise<T | null> {
    return this.cache.get(key);
  }

  async set(key: string, value: T): Promise<void> {
    this.cache.set(key, value);
  }
}

// Persists across restarts/redeploys/spin-downs, unlike the in-memory
// fallback - a separate hosted store, not tied to this web service's
// lifecycle. Errors degrade to a cache miss rather than failing the
// request - a down cache shouldn't take Illuminate down with it.
class UpstashSharedCache<T> implements SharedCache<T> {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    private readonly keyPrefix: string,
    ttlMs: number
  ) {
    this.ttlSeconds = Math.round(ttlMs / 1000);
  }

  async get(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get<T>(`${this.keyPrefix}${key}`);
      return value ?? null;
    } catch (error) {
      console.error('Upstash get failed, treating as a cache miss:', error);
      return null;
    }
  }

  async set(key: string, value: T): Promise<void> {
    try {
      await this.redis.set(`${this.keyPrefix}${key}`, value, { ex: this.ttlSeconds });
    } catch (error) {
      console.error('Upstash set failed:', error);
    }
  }
}

export function createSharedCache<T>(keyPrefix: string, ttlMs: number, maxEntries: number): SharedCache<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    return new UpstashSharedCache<T>(new Redis({ url, token }), keyPrefix, ttlMs);
  }

  console.info('UPSTASH_REDIS_REST_URL/TOKEN not set - using in-memory cache (resets on restart)');
  return new InMemorySharedCache<T>(ttlMs, maxEntries);
}
