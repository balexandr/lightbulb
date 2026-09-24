import { GET } from '@/app/api/flags+api';

describe('GET /api/flags', () => {
  const originalRedditEnabled = process.env.FEATURE_REDDIT_ENABLED;
  const originalOAuthCompliant = process.env.REDDIT_OAUTH_COMPLIANT;

  afterEach(() => {
    process.env.FEATURE_REDDIT_ENABLED = originalRedditEnabled;
    process.env.REDDIT_OAUTH_COMPLIANT = originalOAuthCompliant;
  });

  it('defaults redditEnabled to false when both env vars are unset', async () => {
    delete process.env.FEATURE_REDDIT_ENABLED;
    delete process.env.REDDIT_OAUTH_COMPLIANT;

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redditEnabled: false });
  });

  it('reads redditEnabled=true from the env var when OAuth compliance is also confirmed', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'true';
    process.env.REDDIT_OAUTH_COMPLIANT = 'true';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: true });
  });

  it('treats any non-"true" value as false', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'yes';
    process.env.REDDIT_OAUTH_COMPLIANT = 'true';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: false });
  });

  it('is case-insensitive', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'TRUE';
    process.env.REDDIT_OAUTH_COMPLIANT = 'TRUE';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: true });
  });

  it('stays disabled when FEATURE_REDDIT_ENABLED is true but OAuth compliance is not confirmed (§12.1 guard)', async () => {
    process.env.FEATURE_REDDIT_ENABLED = 'true';
    delete process.env.REDDIT_OAUTH_COMPLIANT;

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: false });
  });

  it('stays disabled when OAuth compliance is confirmed but the feature flag itself is off', async () => {
    delete process.env.FEATURE_REDDIT_ENABLED;
    process.env.REDDIT_OAUTH_COMPLIANT = 'true';

    const response = await GET();

    expect(await response.json()).toEqual({ redditEnabled: false });
  });
});
