import { getClientIp } from './clientIp';

function makeRequest(forwardedFor?: string): Request {
  return new Request('http://localhost/api/whatever', {
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  });
}

describe('getClientIp', () => {
  it('returns "unknown" when the header is absent', () => {
    expect(getClientIp(makeRequest())).toBe('unknown');
  });

  it('returns the single value when there is only one hop', () => {
    expect(getClientIp(makeRequest('203.0.113.5'))).toBe('203.0.113.5');
  });

  it('returns the last hop, not the first, when the header has multiple entries', () => {
    // Render appends the real client IP as the last hop - the first entry
    // here is attacker-controlled (see the module comment).
    expect(getClientIp(makeRequest('9.9.9.9, 203.0.113.5'))).toBe('203.0.113.5');
  });

  it('trims whitespace around the trusted hop', () => {
    expect(getClientIp(makeRequest('9.9.9.9,   203.0.113.5  '))).toBe('203.0.113.5');
  });

  it('is not fooled by an attacker appending extra fake hops after their own IP', () => {
    // Render still only ever appends exactly one hop (its own view of the
    // connection) after whatever the client sent, so the last entry stays
    // trustworthy no matter how many fake entries the client prepends.
    expect(getClientIp(makeRequest('1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.5'))).toBe('203.0.113.5');
  });
});
