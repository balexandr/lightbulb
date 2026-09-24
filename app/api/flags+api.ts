import { DEFAULT_FEATURE_FLAGS, FeatureFlags } from '@/types/featureFlags';

// Lets flags flip via a Render env var + restart, instead of an app-store
// review cycle (native) or a redeploy (web) for every toggle.
function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

// Reddit was pulled from the source list (docs/TECHNICAL_GUIDE.md §12.1)
// over unauthenticated-access and AI-training-use risk under Reddit's
// Developer Terms - not permanently, but "re-added" requires
// redditParser.ts to actually be migrated to authenticated OAuth requests
// first, per §12.1's own "if re-added" checklist. FEATURE_REDDIT_ENABLED
// alone must never be enough to turn Reddit back on - REDDIT_OAUTH_COMPLIANT
// is a second, independent env var that should only ever be set once that
// migration is done, so flipping one flag during a routine config change
// can't silently reintroduce the legal exposure. This matters more, not
// less, once the app stops being free/no-ads/no-IAP (§12.5) - Reddit's
// free non-commercial tier stops applying at that point regardless of
// this flag.
function isRedditOAuthCompliant(): boolean {
  return parseBoolEnv(process.env.REDDIT_OAUTH_COMPLIANT, false);
}

export async function GET(): Promise<Response> {
  const redditRequested = parseBoolEnv(process.env.FEATURE_REDDIT_ENABLED, DEFAULT_FEATURE_FLAGS.redditEnabled);

  const flags: FeatureFlags = {
    redditEnabled: redditRequested && isRedditOAuthCompliant(),
  };

  return Response.json(flags);
}
