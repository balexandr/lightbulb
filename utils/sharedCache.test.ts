import { Redis } from '@upstash/redis';

import { createSharedCache } from './sharedCache';

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));

const MockRedis = jest.mocked(Redis);

describe('createSharedCache', () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    jest.clearAllMocks();
  });

  describe('without Upstash configured', () => {
    beforeEach(() => {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    });

    it('falls back to an in-memory cache that still round-trips values', async () => {
      const cache = createSharedCache<string>('test:', 60_000, 10);

      expect(await cache.get('a')).toBeNull();
      await cache.set('a', 'hello');
      expect(await cache.get('a')).toBe('hello');
      expect(MockRedis).not.toHaveBeenCalled();
    });
  });

  describe('with Upstash configured', () => {
    const mockGet = jest.fn();
    const mockSet = jest.fn();

    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
      MockRedis.mockImplementation(() => ({ get: mockGet, set: mockSet }) as unknown as Redis);
    });

    it('constructs a Redis client from the env vars', () => {
      createSharedCache<string>('test:', 60_000, 10);
      expect(MockRedis).toHaveBeenCalledWith({ url: 'https://example.upstash.io', token: 'test-token' });
    });

    it('reads through to redis.get with the prefixed key', async () => {
      mockGet.mockResolvedValue('cached-value');
      const cache = createSharedCache<string>('fact:', 60_000, 10);

      const result = await cache.get('article-1');

      expect(result).toBe('cached-value');
      expect(mockGet).toHaveBeenCalledWith('fact:article-1');
    });

    it('returns null on a miss', async () => {
      mockGet.mockResolvedValue(null);
      const cache = createSharedCache<string>('fact:', 60_000, 10);

      expect(await cache.get('article-1')).toBeNull();
    });

    it('writes through to redis.set with the prefixed key and a TTL in seconds', async () => {
      const cache = createSharedCache<string>('fact:', 60_000, 10);

      await cache.set('article-1', 'a value');

      expect(mockSet).toHaveBeenCalledWith('fact:article-1', 'a value', { ex: 60 });
    });

    it('degrades to a cache miss (not a thrown error) when redis.get fails', async () => {
      mockGet.mockRejectedValue(new Error('network blip'));
      const cache = createSharedCache<string>('fact:', 60_000, 10);

      await expect(cache.get('article-1')).resolves.toBeNull();
    });

    it('swallows an error from redis.set rather than failing the caller', async () => {
      mockSet.mockRejectedValue(new Error('network blip'));
      const cache = createSharedCache<string>('fact:', 60_000, 10);

      await expect(cache.set('article-1', 'a value')).resolves.toBeUndefined();
    });
  });
});
