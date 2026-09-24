import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = new RateLimiter(3, 60_000);

    expect(limiter.check('a', 0).limited).toBe(false);
    expect(limiter.check('a', 1).limited).toBe(false);
    expect(limiter.check('a', 2).limited).toBe(false);
  });

  it('blocks the request that exceeds the limit within the window', () => {
    const limiter = new RateLimiter(2, 60_000);

    expect(limiter.check('a', 0).limited).toBe(false);
    expect(limiter.check('a', 1).limited).toBe(false);
    const third = limiter.check('a', 2);

    expect(third.limited).toBe(true);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks separate keys independently', () => {
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.check('a', 0).limited).toBe(false);
    expect(limiter.check('b', 0).limited).toBe(false);
    expect(limiter.check('a', 1).limited).toBe(true);
  });

  it('resets once the window has elapsed', () => {
    const limiter = new RateLimiter(1, 60_000);

    expect(limiter.check('a', 0).limited).toBe(false);
    expect(limiter.check('a', 30_000).limited).toBe(true);
    expect(limiter.check('a', 60_000).limited).toBe(false);
  });

  it('caps the number of tracked clients instead of growing unbounded', () => {
    // Simulates a client cycling a fresh fake key on every request (e.g. a
    // spoofed X-Forwarded-For value) to dodge the per-key limit - the
    // limiter itself must still stay bounded in memory.
    const limiter = new RateLimiter(1, 60_000, 3);

    for (let i = 0; i < 1000; i++) {
      limiter.check(`fake-client-${i}`, 0);
    }

    // Only the most recent maxTrackedClients keys survive; older ones were
    // evicted and so are treated as fresh (unlimited) again.
    expect(limiter.check('fake-client-999', 1).limited).toBe(true);
    expect(limiter.check('fake-client-0', 1).limited).toBe(false);
  });
});
