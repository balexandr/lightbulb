import { DEFAULT_FEATURE_FLAGS, FeatureFlags } from '@/types/featureFlags';

// Lets flags flip via a Render env var + restart, instead of an app-store
// review cycle (native) or a redeploy (web) for every toggle.
function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export async function GET(): Promise<Response> {
  const flags: FeatureFlags = {
    redditEnabled: parseBoolEnv(process.env.FEATURE_REDDIT_ENABLED, DEFAULT_FEATURE_FLAGS.redditEnabled),
  };

  return Response.json(flags);
}
