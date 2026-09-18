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

const explanation = {
  summary: 'summary',
  why: 'why',
  impact: 'impact',
  credibility: 'credibility',
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/illuminate', {
    method: 'POST',
    body: JSON.stringify(body),
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
    const request = new Request('http://localhost/api/illuminate', { method: 'POST', body: 'not-json' });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when item title or source is missing', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const response = await POST(makeRequest({ item: { title: '', source: { name: 'BBC' } } }));
    expect(response.status).toBe(400);
  });

  it('returns the parsed explanation on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: explanation });

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' }, domain: 'bbc.com' } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(explanation);
  });

  it('returns 502 when Claude responds with a malformed shape', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: null });

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' } } }));
    expect(response.status).toBe(502);
  });

  it('propagates a 429 when Claude rate-limits the request', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockRejectedValue(
      new Anthropic.RateLimitError(429, { message: 'rate limited' }, 'rate limited', new Headers())
    );

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' } } }));
    expect(response.status).toBe(429);
  });

  it('returns 502 for any other Claude API failure', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockRejectedValue(
      new Anthropic.APIError(500, { message: 'boom' }, 'boom', new Headers())
    );

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' } } }));
    expect(response.status).toBe(502);
  });
});
