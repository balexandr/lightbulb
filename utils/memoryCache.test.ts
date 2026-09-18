import { MemoryCache } from './memoryCache';

describe('MemoryCache', () => {
  it('returns null for a key that was never set', () => {
    const cache = new MemoryCache<string>(60_000, 10);
    expect(cache.get('missing')).toBeNull();
  });

  it('round-trips a cached value', () => {
    const cache = new MemoryCache<string>(60_000, 10);
    cache.set('a', 'hello', 0);
    expect(cache.get('a', 1)).toBe('hello');
  });

  it('expires a value once its TTL has elapsed', () => {
    const cache = new MemoryCache<string>(60_000, 10);
    cache.set('a', 'hello', 0);
    expect(cache.get('a', 60_000)).toBeNull();
  });

  it('keeps different keys independent', () => {
    const cache = new MemoryCache<string>(60_000, 10);
    cache.set('a', 'one', 0);
    cache.set('b', 'two', 0);
    expect(cache.get('a', 1)).toBe('one');
    expect(cache.get('b', 1)).toBe('two');
  });

  it('evicts the oldest entry once over capacity', () => {
    const cache = new MemoryCache<string>(60_000, 2);
    cache.set('a', 'one', 0);
    cache.set('b', 'two', 1);
    cache.set('c', 'three', 2);

    expect(cache.get('a', 3)).toBeNull();
    expect(cache.get('b', 3)).toBe('two');
    expect(cache.get('c', 3)).toBe('three');
  });
});
