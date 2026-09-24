import { flagService } from './flagService';
import { PreferenceBucket } from './preferencesService';

const bucket: PreferenceBucket = { age: 'unspecified', stance: 'unspecified', region: 'unspecified', gender: 'unspecified' };

describe('FlagService.submitFlag', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('posts the submission to /api/flag', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    await flagService.submitFlag({ url: 'https://example.com/a', bucket, flaggedField: 'wrong', freeText: 'nope' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/flag'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/a', bucket, flaggedField: 'wrong', freeText: 'nope' }),
      })
    );
  });

  it('throws with the server-provided error message when the request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'bad field' }) });

    await expect(
      flagService.submitFlag({ url: 'https://example.com/a', bucket, flaggedField: 'off' })
    ).rejects.toThrow('bad field');
  });

  it('falls back to a generic error when the failed response has no body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('no body'); } });

    await expect(
      flagService.submitFlag({ url: 'https://example.com/a', bucket, flaggedField: 'off' })
    ).rejects.toThrow('Flag submission failed (500)');
  });
});
