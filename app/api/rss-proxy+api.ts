import { REDDIT_SUBREDDITS, RSS_FEEDS } from '@/constants/newsConfig';
import { RateLimiter } from '@/utils/rateLimiter';

// The web build can't fetch RSS/Reddit feeds directly (those origins don't
// send CORS headers for our origin) and previously depended entirely on a
// third-party CORS proxy (api.allorigins.win) - which turned out to have a
// full outage, taking every single source down with it at once. This
// first-party route replaces that dependency for feed fetching, using
// infrastructure this server already has.
//
// Deliberately NOT a general-purpose proxy: only the exact feed URLs this
// app itself knows about are allowed through, so this can't be used as an
// open relay for arbitrary requests (SSRF). Article-page scraping for OG
// images (arbitrary URLs, not just our known feeds) still goes through the
// third-party proxy - lower stakes, since it already degrades gracefully
// to a favicon on failure.
const RATE_LIMIT_MAX_REQUESTS = 120;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimiter = new RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

const ALLOWED_URLS = new Set<string>([
  ...RSS_FEEDS.map(feed => feed.url),
  ...REDDIT_SUBREDDITS.map(subreddit => `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`),
]);

const UPSTREAM_TIMEOUT_MS = 10000;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

export async function GET(request: Request): Promise<Response> {
  const rateLimit = rateLimiter.check(getClientIp(request));
  if (rateLimit.limited) {
    return Response.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const targetUrl = new URL(request.url).searchParams.get('url');
  if (!targetUrl || !ALLOWED_URLS.has(targetUrl)) {
    return Response.json({ error: 'URL not allowed.' }, { status: 403 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Lightbulb News App/1.0' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    return new Response(body, { status: upstream.status, headers: { 'Content-Type': contentType } });
  } catch {
    return Response.json({ error: 'Upstream feed fetch failed.' }, { status: 502 });
  }
}
