import AsyncStorage from '@react-native-async-storage/async-storage';

import { FeatureFlagsService } from './featureFlagsService';
import { DEFAULT_FEATURE_FLAGS } from '@/types/featureFlags';

describe('FeatureFlagsService', () => {
  let featureFlagsService: FeatureFlagsService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    featureFlagsService = new FeatureFlagsService();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and returns flags from the server on a cache miss', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ redditEnabled: true }),
    });

    const flags = await featureFlagsService.getFlags();

    expect(flags).toEqual({ redditEnabled: true });
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/flags'));
  });

  it('serves from cache without re-fetching on a subsequent call', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ redditEnabled: true }),
    });

    await featureFlagsService.getFlags();
    const second = await featureFlagsService.getFlags();

    expect(second).toEqual({ redditEnabled: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to defaults when the fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));

    const flags = await featureFlagsService.getFlags();

    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('falls back to defaults on a non-2xx response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const flags = await featureFlagsService.getFlags();

    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('merges a partial server response over the defaults', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const flags = await featureFlagsService.getFlags();

    expect(flags).toEqual(DEFAULT_FEATURE_FLAGS);
  });

  it('re-fetches once the cached flags have expired', async () => {
    const realNow = Date.now;
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ redditEnabled: true }),
    });

    Date.now = () => 1_000_000;
    await featureFlagsService.getFlags();

    Date.now = () => 1_000_000 + 16 * 60 * 1000; // past the 15-minute TTL
    await featureFlagsService.getFlags();

    Date.now = realNow;
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
