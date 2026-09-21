import { POST } from '@/app/api/flag+api';

let ipCounter = 0;
function makeRequest(body: unknown, ip: string = `10.0.2.${++ipCounter}`): Request {
  return new Request('http://localhost/api/flag', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'x-forwarded-for': ip },
  });
}

describe('POST /api/flag', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('returns 400 for invalid JSON', async () => {
    const request = new Request('http://localhost/api/flag', {
      method: 'POST',
      body: 'not-json',
      headers: { 'x-forwarded-for': `10.0.2.${++ipCounter}` },
    });

    expect((await POST(request)).status).toBe(400);
  });

  it('returns 400 when url is missing', async () => {
    const response = await POST(makeRequest({ flaggedField: 'wrong' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when flaggedField is not a recognized reason', async () => {
    const response = await POST(makeRequest({ url: 'https://example.com/a', flaggedField: 'bogus' }));
    expect(response.status).toBe(400);
  });

  it('returns 400 when freeText exceeds the max length', async () => {
    const response = await POST(
      makeRequest({ url: 'https://example.com/a', flaggedField: 'off', freeText: 'x'.repeat(501) })
    );
    expect(response.status).toBe(400);
  });

  it('accepts a valid flag and logs it without a persistent store', async () => {
    const response = await POST(
      makeRequest({
        url: 'https://example.com/a',
        bucket: { age: '25-34', stance: 'unspecified', region: 'unspecified' },
        flaggedField: 'too_persuasive',
        freeText: 'This nudged an opinion.',
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(logSpy).toHaveBeenCalledWith(
      '🚩 Explanation flagged',
      expect.objectContaining({ url: 'https://example.com/a', flaggedField: 'too_persuasive' })
    );
  });

  it('accepts a valid flag with no freeText or bucket', async () => {
    const response = await POST(makeRequest({ url: 'https://example.com/a', flaggedField: 'wrong' }));
    expect(response.status).toBe(200);
  });

  it('rate-limits after the per-IP threshold is exceeded', async () => {
    const ip = `10.0.2.${++ipCounter}`;
    for (let i = 0; i < 10; i++) {
      const response = await POST(makeRequest({ url: 'https://example.com/a', flaggedField: 'wrong' }, ip));
      expect(response.status).toBe(200);
    }

    const limited = await POST(makeRequest({ url: 'https://example.com/a', flaggedField: 'wrong' }, ip));
    expect(limited.status).toBe(429);
  });
});
