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
});
