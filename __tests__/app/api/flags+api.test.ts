import { GET } from '@/app/api/flags+api';

describe('GET /api/flags', () => {
  const originalValue = process.env.FEATURE_REDDIT_ENABLED;

  afterEach(() => {
    process.env.FEATURE_REDDIT_ENABLED = originalValue;
  });

  it('defaults redditEnabled to false when the env var is unset', async () => {
    delete process.env.FEATURE_REDDIT_ENABLED;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redditEnabled: false });
  });

  it('reads redditEnabled=true from the env var', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'true';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: true });
  });

  it('treats any non-"true" value as false', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'yes';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: false });
  });

  it('is case-insensitive', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'TRUE';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: true });
  });
});
