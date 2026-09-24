import { PreferenceBucket } from '@/services/preferencesService';
import { getClientIp } from '@/utils/clientIp';
import { RateLimiter } from '@/utils/rateLimiter';

// Low-traffic, abuse-prone endpoint (no auth, free-form text) - a tighter
// limit than /api/illuminate is appropriate even though this costs no
// Anthropic tokens.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimiter = new RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

const MAX_FREE_TEXT_LENGTH = 500;
const FLAG_REASONS = ['wrong', 'off', 'too_persuasive'] as const;
type FlagReason = (typeof FLAG_REASONS)[number];

interface FlagRequestBody {
  url: string;
  bucket?: PreferenceBucket;
  flaggedField: FlagReason;
  freeText?: string;
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = rateLimiter.check(getClientIp(request));
  if (rateLimit.limited) {
    return Response.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  let body: FlagRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.url || typeof body.url !== 'string') {
    return Response.json({ error: 'url is required.' }, { status: 400 });
  }
  if (!FLAG_REASONS.includes(body.flaggedField)) {
    return Response.json(
      { error: `flaggedField must be one of: ${FLAG_REASONS.join(', ')}.` },
      { status: 400 }
    );
  }
  if (body.freeText !== undefined && body.freeText.length > MAX_FREE_TEXT_LENGTH) {
    return Response.json(
      { error: `freeText must be ${MAX_FREE_TEXT_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  // §18.5: "doesn't need a full backend, a simple write-to-log ... is
  // enough at launch scale" - reviewed via Render's log viewer. Deliberately
  // anonymous - no user/device identity is logged, consistent with §12.4.
  console.log('🚩 Explanation flagged', {
    url: body.url,
    bucket: body.bucket,
    flaggedField: body.flaggedField,
    freeText: body.freeText,
    at: new Date().toISOString(),
  });

  return Response.json({ ok: true });
}
