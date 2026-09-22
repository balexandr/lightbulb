import { Platform } from 'react-native';

/**
 * Network utilities for handling CORS and headers
 */

// Routes RSS/Reddit feed fetches and article-page OG-image scraping through
// this app's own /api/rss-proxy (server-side fetch, no CORS involved)
// instead of a third-party CORS proxy, which was observed to have full
// outages. That route allowlists both our exact known feed URLs and
// article pages on TRUSTED_NEWS_DOMAINS - see app/api/rss-proxy+api.ts for
// why this is safe rather than an open relay.
export function getFeedProxyUrl(url: string): string {
  if (Platform.OS === 'web') {
    return `${getApiBaseUrl()}/api/rss-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getRequestHeaders(isRSS: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': isRSS
      ? 'application/rss+xml, application/xml, text/xml, */*'
      : 'application/json',
  };

  if (Platform.OS !== 'web') {
    headers['User-Agent'] = 'Lightbulb News App/1.0';
  }

  return headers;
}

// On web, our own API routes (/api/illuminate, /api/flags) are same-origin.
// Native builds have no origin of their own, so they need the deployed
// server's absolute URL.
export function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
}