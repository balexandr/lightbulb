import Anthropic from '@anthropic-ai/sdk';

import { POST } from '@/app/api/briefing+api';

const mockParse = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  const actual = jest.requireActual('@anthropic-ai/sdk');
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { parse: mockParse },
  }));
  Object.setPrototypeOf(MockAnthropic, actual.default);
  return { __esModule: true, default: MockAnthropic };
});

jest.mock('@upstash/redis', () => ({ Redis: jest.fn() }));

let titleCounter = 0;
function makeItem(overrides: { cachedSummary?: string; domain?: string } = {}) {
  return { title: `Briefing story ${++titleCounter}`, source: { name: 'BBC' }, ...overrides };
}

let ipCounter = 0;
function makeRequest(body: unknown, ip: string = `10.0.1.${++ipCounter}`): Request {
  return new Request('http://localhost/api/briefing', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': ip },
  });
}

describe('POST /api/briefing', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
    jest.clearAllMocks();
  });

  it('returns 503 when no server-side API key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const response = await POST(makeRequest({ items: [makeItem()] }));

    expect(response.status).toBe(503);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const request = new Request('http://localhost/api/briefing', {
      method: 'POST',
      body: 'not-json',
      headers: { 'x-forwarded-for': `10.0.1.${++ipCounter}` },
    });

    expect((await POST(request)).status).toBe(400);
  });

  it('returns 400 when items is empty', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const response = await POST(makeRequest({ items: [] }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when an item is missing a title or source', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const response = await POST(makeRequest({ items: [{ source: { name: 'BBC' } }] }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when more than the max number of stories is requested', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const items = Array.from({ length: 7 }, () => makeItem());

    const response = await POST(makeRequest({ items }));
    expect(response.status).toBe(400);
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('generates a script from the given stories', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: { script: 'Good morning. Here is your briefing.' } });

    const response = await POST(makeRequest({ items: [makeItem(), makeItem({ cachedSummary: 'A cached fact.' })] }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ script: 'Good morning. Here is your briefing.' });

    const [[callArgs]] = mockParse.mock.calls;
    expect(callArgs.messages[0].content).toContain('A cached fact.');
  });

  it('caches the script and skips a second Claude call for the same stories and bucket', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: { script: 'Cached briefing script.' } });
    const items = [makeItem(), makeItem()];
    const bucket = { age: 'unspecified' as const, stance: 'unspecified' as const, region: 'unspecified' as const };

    const first = await POST(makeRequest({ items, bucket }));
    const second = await POST(makeRequest({ items, bucket }));

    expect(await first.json()).toEqual({ script: 'Cached briefing script.' });
    expect(await second.json()).toEqual({ script: 'Cached briefing script.' });
    expect(mockParse).toHaveBeenCalledTimes(1);
  });

  it('includes the persuasion guardrail in the system prompt', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: { script: 'A script.' } });

    await POST(makeRequest({ items: [makeItem()] }));

    const [[callArgs]] = mockParse.mock.calls;
    expect(callArgs.system).toMatch(/never state or imply what opinion/i);
  });

  it('returns 502 when the response is malformed', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockResolvedValue({ parsed_output: null });

    const response = await POST(makeRequest({ items: [makeItem()] }));
    expect(response.status).toBe(502);
  });

  it('propagates a 429 when Claude rate-limits the request', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    mockParse.mockRejectedValue(
      new Anthropic.RateLimitError(429, { message: 'rate limited' }, 'rate limited', new Headers())
    );

    const response = await POST(makeRequest({ items: [makeItem()] }));
    expect(response.status).toBe(429);
  });
});
