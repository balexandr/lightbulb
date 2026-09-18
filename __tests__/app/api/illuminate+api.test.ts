import Anthropic from '@anthropic-ai/sdk';

import { POST } from '@/app/api/illuminate+api';

const mockParse = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { parse: mockParse },
  }));
  // Static error classes (RateLimitError, APIError, ...) live on the real
  // class's prototype chain, not as own properties - point the mock's
  // prototype at the real default export so `Anthropic.RateLimitError`
  // still resolves to the real class, both here and in the route.
  Object.setPrototypeOf(MockAnthropic, actual.default);
  return { __esModule: true, default: MockAnthropic };
});

// Never load the real client - UPSTASH_REDIS_REST_URL/TOKEN aren't set in
// tests, so createSharedCache always falls back to the in-memory cache
// anyway; this just keeps the real (ESM) package out of the test run.
jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));

const fact = { summary: 'summary', credibility: 'credibility' };
const relevance = { why: 'why', impact: 'impact' };

// Each call gets its own IP by default so tests don't share a rate-limit
// bucket, and each item gets its own title so tests don't share a shared
// fact/relevance cache entry - both limiter and caches are module-level
// singletons for the route's lifetime (see app/api/illuminate+api.ts).
let ipCounter = 0;
let titleCounter = 0;
function makeItem(overrides: { domain?: string } = {}) {
  return { title: `Big news ${++titleCounter}`, source: { name: 'BBC' }, ...overrides };
}
function makeRequest(body: unknown, ip: string = `10.0.0.${++ipCounter}`): Request {
  return new Request('http://localhost/api/illuminate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': ip },
  });
}

describe('POST /api/illuminate', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
    jest.clearAllMocks();
  });

  it('returns 503 when no server-side API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await POST(makeRequest({ item: { title: 't', source: { name: 'BBC' } } }));

    expect(response.status).toBe(503);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const request = new Request('http://localhost/api/illuminate', {
      method: 'POST',
      body: 'not-json',
      headers: { 'x-forwarded-for': `10.0.0.${++ipCounter}` },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when item title or source is missing', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const response = await POST(makeRequest({ item: { title: '', source: { name: 'BBC' } } }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when neither needFact nor needRelevance is requested', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const response = await POST(
      makeRequest({ item: { title: 't', source: { name: 'BBC' } }, needFact: false, needRelevance: false })
    );

    expect(response.status).toBe(400);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('returns 400 when requesting relevance without fact or a factSummary', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const response = await POST(
      makeRequest({ item: { title: 't', source: { name: 'BBC' } }, needFact: false, needRelevance: true })
    );

    expect(response.status).toBe(400);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('generates both layers by default and returns them together', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: fact }).mockResolvedValueOnce({ parsed_output: relevance });

    const response = await POST(makeRequest({ item: makeItem({ domain: 'bbc.com' }) }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fact, relevance });
    expect(mockParse).toHaveBeenCalledTimes(2);
  });

  it('only generates the fact layer when only fact is requested', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: fact });

    const response = await POST(
      makeRequest({ item: makeItem(), needFact: true, needRelevance: false })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ fact });
    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  it('only generates the relevance layer when a cached factSummary is supplied', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: relevance });

    const response = await POST(
      makeRequest({
        item: makeItem(),
        needFact: false,
        needRelevance: true,
        factSummary: 'a cached summary',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ relevance });
    expect(mockParse).toHaveBeenCalledTimes(1);
    // The relevance prompt should be built from the cached summary, not re-derive facts.
    const [[callArgs]] = mockParse.mock.calls;
    expect(callArgs.messages[0].content).toContain('a cached summary');
  });

  it('passes the bucket into the relevance prompt when set', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: fact }).mockResolvedValueOnce({ parsed_output: relevance });

    await POST(
      makeRequest({
        item: makeItem(),
        bucket: { age: '25-34', stance: 'progressive', region: 'unspecified' },
      })
    );

    const relevanceCallArgs = mockParse.mock.calls[1][0];
    expect(relevanceCallArgs.messages[0].content).toContain('25-34');
    expect(relevanceCallArgs.messages[0].content).toContain('progressive');
  });

  it('never sends bucket/preference data in the fact-layer prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: fact }).mockResolvedValueOnce({ parsed_output: relevance });

    await POST(
      makeRequest({
        item: makeItem(),
        bucket: { age: '25-34', stance: 'progressive', region: 'unspecified' },
      })
    );

    const factCallArgs = mockParse.mock.calls[0][0];
    expect(factCallArgs.messages[0].content).not.toContain('25-34');
    expect(factCallArgs.messages[0].content).not.toContain('progressive');
  });

  it('includes the anti-persuasion guardrail in the relevance system prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: fact }).mockResolvedValueOnce({ parsed_output: relevance });

    await POST(makeRequest({ item: makeItem() }));

    const relevanceCallArgs = mockParse.mock.calls[1][0];
    expect(relevanceCallArgs.system).toMatch(/never state or imply what opinion/i);
  });

  it('returns 502 when the fact response is malformed', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: null });

    const response = await POST(makeRequest({ item: makeItem() }));
    expect(response.status).toBe(502);
  });

  it('returns 502 when the relevance response is malformed', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValueOnce({ parsed_output: fact }).mockResolvedValueOnce({ parsed_output: null });

    const response = await POST(makeRequest({ item: makeItem() }));
    expect(response.status).toBe(502);
  });

  it('propagates a 429 when Claude rate-limits the request', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockRejectedValue(
      new Anthropic.RateLimitError(429, { message: 'rate limited' }, 'rate limited', new Headers())
    );

    const response = await POST(makeRequest({ item: makeItem() }));
    expect(response.status).toBe(429);
  });

  it('returns 502 for any other Claude API failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockRejectedValue(
      new Anthropic.APIError(500, { message: 'boom' }, 'boom', new Headers())
    );

    const response = await POST(makeRequest({ item: makeItem() }));
    expect(response.status).toBe(502);
  });

  it('rate-limits a single IP after 20 requests within a minute, independent of other IPs', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: fact });
    const body = { item: makeItem(), needFact: true, needRelevance: false };
    const hammeredIp = '203.0.113.1';

    for (let i = 0; i < 20; i++) {
      const response = await POST(makeRequest(body, hammeredIp));
      expect(response.status).toBe(200);
    }

    const blocked = await POST(makeRequest(body, hammeredIp));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    expect(await blocked.json()).toEqual({ error: 'Too many requests. Please try again shortly.' });

    // A different IP is unaffected by the first one's limit.
    const otherIp = await POST(makeRequest(body, '203.0.113.2'));
    expect(otherIp.status).toBe(200);

    // Same article/bucket, 20 identical requests - the shared fact cache
    // should mean only the very first one actually called Claude.
    expect(mockParse).toHaveBeenCalledTimes(1);
  });
});
