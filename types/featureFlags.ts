// Server-driven feature flags, fetched from /api/flags (see app/api/flags+api.ts)
// and cached client-side by featureFlagsService. Keep this shape in sync
// between the API route and the client - both import it from here.
export interface FeatureFlags {
  redditEnabled: boolean;
}

// Used both as the server's per-flag default (when its env var is unset)
// and as the client's fallback when /api/flags can't be reached at all.
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  redditEnabled: false,
};
