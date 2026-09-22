import { RSS_FEEDS } from '@/constants/newsConfig';

import { GET } from '@/app/api/rss-proxy+api';

let ipCounter = 0;
function makeRequest(url: string, ip: string = `10.0.3.${++ipCounter}`): Request {
  return new Request(`http://localhost/api/rss-proxy?url=${encodeURIComponent(url)}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('GET /api/rss-proxy', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when no url is given', async () => {
    const response = await GET(new Request('http://localhost/api/rss-proxy', { headers: { 'x-forwarded-for': `10.0.3.${++ipCounter}` } }));
    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 403 for a URL that is not one of our known feeds', async () => {
    const response = await GET(makeRequest('https://evil.example.com/internal-admin'));
    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches and passes through an allowlisted RSS feed URL', async () => {
    const feedUrl = RSS_FEEDS[0].url;
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/rss+xml' }),
      text: async () => '<rss>ok</rss>',
    });

    const response = await GET(makeRequest(feedUrl));

    expect(global.fetch).toHaveBeenCalledWith(feedUrl, expect.objectContaining({ headers: expect.any(Object) }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('<rss>ok</rss>');
    expect(response.headers.get('content-type')).toBe('application/rss+xml');
  });

  it('fetches and passes through an allowlisted Reddit URL', async () => {
    const redditUrl = 'https://www.reddit.com/r/worldnews/hot.json?limit=25';
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"data":{"children":[]}}',
    });

    const response = await GET(makeRequest(redditUrl));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"data":{"children":[]}}');
  });

  it('returns 502 when the upstream fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('upstream down'));

    const response = await GET(makeRequest(RSS_FEEDS[0].url));
    expect(response.status).toBe(502);
  });

  it('rate-limits after the per-IP threshold is exceeded', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      headers: new Headers({ 'content-type': 'application/rss+xml' }),
      text: async () => 'ok',
    });

    const ip = `10.0.3.${++ipCounter}`;
    for (let i = 0; i < 300; i++) {
      const response = await GET(makeRequest(RSS_FEEDS[0].url, ip));
      expect(response.status).toBe(200);
    }

    const limited = await GET(makeRequest(RSS_FEEDS[0].url, ip));
    expect(limited.status).toBe(429);
  });

  describe('trusted-domain article pages (for OG-image scraping)', () => {
    it('allows an https article URL on a TRUSTED_NEWS_DOMAINS host, even though the exact URL is unknown ahead of time', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html><head><meta property="og:image" content="https://techcrunch.com/photo.jpg"/></head></html>',
      });

      const response = await GET(makeRequest('https://techcrunch.com/2026/09/22/some-article/'));

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('og:image');
    });

    it('allows a subdomain of a trusted domain', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html></html>',
      });

      const response = await GET(makeRequest('https://www.bbc.com/news/some-article'));
      expect(response.status).toBe(200);
    });

    it('rejects a domain that merely contains a trusted domain as a substring', async () => {
      const response = await GET(makeRequest('https://not-techcrunch.com/phishing'));
      expect(response.status).toBe(403);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a non-https URL even on a trusted domain', async () => {
      const response = await GET(makeRequest('http://techcrunch.com/insecure'));
      expect(response.status).toBe(403);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects an untrusted domain entirely', async () => {
      const response = await GET(makeRequest('https://random-blog.example.com/post'));
      expect(response.status).toBe(403);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
