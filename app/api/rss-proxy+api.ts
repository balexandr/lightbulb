import { REDDIT_SUBREDDITS, RSS_FEEDS, TRUSTED_NEWS_DOMAINS } from '@/constants/newsConfig';
import { getClientIp } from '@/utils/clientIp';
import { RateLimiter } from '@/utils/rateLimiter';

// The web build can't fetch RSS/Reddit feeds (or scrape article pages for
// an OG image) directly - those origins don't send CORS headers for our
// origin - and previously depended entirely on a third-party CORS proxy
// (api.allorigins.win), which turned out to have a full outage, taking
// every single source down with it at once. This first-party route
// replaces that dependency, using infrastructure this server already has.
//
// Two allowlists, not a general-purpose proxy:
// - Feed fetches must match one of our own known RSS/Reddit URLs exactly.
// - Article-page fetches (for OG-image scraping - a source like TechCrunch
//   has zero embedded images in its RSS, so every card depends on this)
//   only need the hostname to be one of TRUSTED_NEWS_DOMAINS, since the
//   exact article URL isn't known ahead of time. Either way, this can't be
//   used as an open relay for arbitrary requests (SSRF).
const RATE_LIMIT_MAX_REQUESTS = 300;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimiter = new RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

const ALLOWED_URLS = new Set<string>([
  ...RSS_FEEDS.map(feed => feed.url),
  ...REDDIT_SUBREDDITS.map(subreddit => `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`),
]);

const UPSTREAM_TIMEOUT_MS = 10000;

function isAllowedTrustedDomain(url: URL): boolean {
  if (url.protocol !== 'https:') return false;
  const hostname = url.hostname.toLowerCase();
  return TRUSTED_NEWS_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

export async function GET(request: Request): Promise<Response> {
  const rateLimit = rateLimiter.check(getClientIp(request));
  if (rateLimit.limited) {
    return Response.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const targetUrlParam = new URL(request.url).searchParams.get('url');
  if (!targetUrlParam) {
    return Response.json({ error: 'URL not allowed.' }, { status: 403 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(targetUrlParam);
  } catch {
    return Response.json({ error: 'URL not allowed.' }, { status: 403 });
  }

  if (!ALLOWED_URLS.has(targetUrlParam) && !isAllowedTrustedDomain(targetUrl)) {
    return Response.json({ error: 'URL not allowed.' }, { status: 403 });
  }

  try {
    const upstream = await fetch(targetUrlParam, {
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
