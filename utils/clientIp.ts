// Render appends to (never replaces) an inbound X-Forwarded-For header
// rather than overwriting it - https://feedback.render.com/features/p/send-the-correct-xforwardedfor
// confirms this. A client that sets its own X-Forwarded-For header lands as
// the FIRST entry; the IP Render's own edge actually saw the connection
// from is appended as the LAST entry. Reading the first entry (the old bug
// here) lets a client rate-limit-dodge by sending a fresh fake IP on every
// request - trusting the last entry instead is correct as long as Render is
// the only proxy in front of this service (true for this deployment).
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (!forwarded) {
    return 'unknown';
  }

  const hops = forwarded.split(',');
  const trustedHop = hops[hops.length - 1]?.trim();
  return trustedHop || 'unknown';
}
