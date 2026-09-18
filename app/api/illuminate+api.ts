import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { UserPreferences } from '@/services/preferencesService';
import { RateLimiter } from '@/utils/rateLimiter';

const CLAUDE_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;

// This route spends real money per call and has no auth - rate-limit by IP
// so a single client can't run up the Anthropic bill. Fixed per-instance;
// see utils/rateLimiter.ts for the tradeoff if this ever runs multi-instance.
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimiter = new RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

const AIExplanationSchema = z.object({
  summary: z.string(),
  why: z.string(),
  impact: z.string(),
  credibility: z.string(),
});

interface IlluminateRequestItem {
  title: string;
  source: { name: string };
  domain?: string;
}

interface IlluminateRequestBody {
  item: IlluminateRequestItem;
  preferences?: UserPreferences;
}

function buildUserContext(preferences: UserPreferences): string {
  const context: string[] = [];

  if (preferences.politicalStandpoint) {
    const standpoints = {
      progressive: 'progressive/left-leaning perspective',
      liberal: 'liberal perspective',
      moderate: 'moderate/centrist perspective',
      conservative: 'conservative perspective',
      libertarian: 'libertarian perspective',
    };
    context.push(`political perspective: ${standpoints[preferences.politicalStandpoint]}`);
  }

  if (preferences.ageRange) {
    context.push(`age range: ${preferences.ageRange}`);
  }

  if (preferences.location) {
    context.push(`location: ${preferences.location}`);
  }

  return context.length > 0
    ? `\n\nUser context: ${context.join(', ')}`
    : '';
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = rateLimiter.check(getClientIp(request));
  if (rateLimit.limited) {
    return Response.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'AI explanations are not configured on this server.' }, { status: 503 });
  }

  let body: IlluminateRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { item, preferences = {} } = body;
  if (!item?.title || !item?.source?.name) {
    return Response.json({ error: 'item.title and item.source.name are required.' }, { status: 400 });
  }

  const userContext = buildUserContext(preferences);

  let impactGuidance = '';
  if (preferences.politicalStandpoint || preferences.ageRange) {
    const aspects: string[] = [];
    if (preferences.politicalStandpoint) {
      aspects.push(`a ${preferences.politicalStandpoint} perspective`);
    }
    if (preferences.ageRange) {
      aspects.push(`someone aged ${preferences.ageRange}`);
    }
    impactGuidance = ` - consider how this might be viewed from ${aspects.join(' and ')} and its relevance to them`;
  }

  const prompt = `Analyze this news headline and provide context:

Title: ${item.title}
Source: ${item.source.name}
${item.domain ? `Domain: ${item.domain}` : ''}${userContext}

Please provide:
1. A brief summary (2-3 sentences)
2. Why this matters (context and background)
3. Potential impact or implications${impactGuidance}
4. Source credibility assessment`;

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: 'You are a helpful news analyst who provides clear, balanced context about news stories. When user preferences are provided, tailor the "impact" section to be relevant to their perspective and demographic while remaining factual and unbiased in other sections. Focus on facts and verifiable information.',
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: zodOutputFormat(AIExplanationSchema),
      },
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'Claude response did not match expected explanation shape.' }, { status: 502 });
    }

    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json({ error: 'Claude request failed.' }, { status: 502 });
  }
}
