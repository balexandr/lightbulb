import { POST } from './illuminate+api';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }));
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
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    jest.clearAllMocks();
  });

  it('returns 503 when no server-side API key is configured', async () => {
    delete process.env.OPENAI_API_KEY;

    const response = await POST(makeRequest({ item: { title: 't', source: { name: 'BBC' } } }));

    expect(response.status).toBe(503);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const request = new Request('http://localhost/api/illuminate', { method: 'POST', body: 'not-json' });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when item title or source is missing', async () => {
    process.env.OPENAI_API_KEY = 'test-key';

    const response = await POST(makeRequest({ item: { title: '', source: { name: 'BBC' } } }));
    expect(response.status).toBe(400);
  });

  it('returns the parsed explanation on success', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(explanation) } }],
    });

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' }, domain: 'bbc.com' } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(explanation);
  });

  it('returns 502 when OpenAI responds with a malformed shape', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ summary: 'only summary' }) } }],
    });

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' } } }));
    expect(response.status).toBe(502);
  });

  it('propagates a 429 when OpenAI rate-limits the request', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreate.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' } } }));
    expect(response.status).toBe(429);
  });

  it('returns 502 for any other OpenAI failure', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    mockCreate.mockRejectedValue(new Error('boom'));

    const response = await POST(makeRequest({ item: { title: 'Big news', source: { name: 'BBC' } } }));
    expect(response.status).toBe(502);
  });
});
