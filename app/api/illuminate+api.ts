import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { PreferenceBucket } from '@/services/preferencesService';
import { FactLayer, RelevanceLayer } from '@/types/news';
import { MemoryCache } from '@/utils/memoryCache';
import { RateLimiter } from '@/utils/rateLimiter';

const CLAUDE_MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;

// This route spends real money per call and has no auth - rate-limit by IP
// so a single client can't run up the Anthropic bill. Fixed per-instance;
// see utils/rateLimiter.ts for the tradeoff if this ever runs multi-instance.
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateLimiter = new RateLimiter(RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS);

// Shared across every request this server instance handles (not per-device
// like cacheService.ts) - the first user anywhere to Illuminate a given
// article/bucket pays for it, everyone else on this instance gets a cache
// hit instead of a Claude call. See utils/memoryCache.ts for the tradeoff.
const SHARED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const factCache = new MemoryCache<FactLayer>(SHARED_CACHE_TTL_MS, 500);
const relevanceCache = new MemoryCache<RelevanceLayer>(SHARED_CACHE_TTL_MS, 2000);

function articleCacheKey(item: IlluminateRequestItem): string {
  // The client never sends the article URL (see aiService.ts), only these
  // three fields - and they're also everything the fact prompt is built
  // from, so two requests with the same title/domain/source will always
  // produce the same fact layer anyway.
  return `${item.title}::${item.domain ?? ''}::${item.source.name}`;
}

function relevanceCacheKey(item: IlluminateRequestItem, bucket: PreferenceBucket): string {
  return `${articleCacheKey(item)}::${bucket.age}::${bucket.stance}::${bucket.region}`;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

const FactLayerSchema = z.object({
  summary: z.string(),
  credibility: z.string(),
});

const RelevanceLayerSchema = z.object({
  why: z.string(),
  impact: z.string(),
});

// Fixed, never touched by user input - see docs/TECHNICAL_GUIDE.md §14.2.
// This layer never sees bucket/preference data at all, so it's identical
// (and cacheable) regardless of who's asking.
const FACT_SYSTEM_PROMPT = `You are a neutral news analyst. Given a news headline, its source, and domain, produce a factual summary and a source credibility assessment.

Rules:
- State facts once, consistently - this must read identically no matter who asks.
- Never speculate beyond what the headline states.
- Never reproduce more than a short paraphrase of the headline - no verbatim article text, even if you recognize the article from training data.`;

// Fixed system rules for the relevance layer, plus the §14.5 guardrail -
// the actual line between "why you'd care" (salience, allowed) and "what
// you should think" (persuasion, forbidden). This is a hard rule, not a
// style preference - re-read docs/TECHNICAL_GUIDE.md §14.5 before touching it.
const RELEVANCE_SYSTEM_PROMPT = `You are a news analyst explaining why a story is relevant to a specific reader, using only their self-selected, broad age range and general political-leaning preference. Never treat these as more precise than they are, and never introduce anything beyond what's given.

Given the story's summary and the reader's context, explain (1) why this story is relevant to someone in their situation, and (2) its potential real-world impact or implications for them.

Hard rule: state facts about the story's relevance to the reader's context and stop there. Never state or imply what opinion, position, or reaction the reader should have.
- Correct (salience): "This matters to you because a Democratic state senator representing your area is pushing back on data center development, a local infrastructure issue."
- Wrong (persuasion): "As a Democrat, you'll likely support this senator's opposition." This assigns the reader an opinion they never gave you.

If the reader's age and political leaning are both unspecified, give a general, audience-agnostic explanation of who is affected and how - no persuasive framing, and don't default to assuming a "moderate" or centrist reader.`;

interface IlluminateRequestItem {
  title: string;
  source: { name: string };
  domain?: string;
}

interface IlluminateRequestBody {
  item: IlluminateRequestItem;
  bucket?: PreferenceBucket;
  needFact?: boolean;
  needRelevance?: boolean;
  // Required when needRelevance is true and needFact is false, so the
  // relevance call has fact context without re-deriving facts itself (§15.5).
  factSummary?: string;
}

function anthropicErrorResponse(error: unknown): Response {
  if (error instanceof Anthropic.RateLimitError) {
    return Response.json({ error: error.message }, { status: 429 });
  }
  if (error instanceof Anthropic.APIError) {
    return Response.json({ error: error.message }, { status: 502 });
  }
  return Response.json({ error: 'Claude request failed.' }, { status: 502 });
}

async function generateFact(anthropic: Anthropic, item: IlluminateRequestItem): Promise<FactLayer | Response> {
  const cacheKey = articleCacheKey(item);
  const cached = factCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prompt = `Title: ${item.title}
Source: ${item.source.name}
${item.domain ? `Domain: ${item.domain}` : ''}

Provide:
1. A brief, neutral 2-3 sentence summary of what this headline describes.
2. A brief, evidence-based assessment of this source's general credibility.`;

  try {
    const response = await anthropic.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: FACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(FactLayerSchema) },
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'Claude fact response did not match expected shape.' }, { status: 502 });
    }
    factCache.set(cacheKey, response.parsed_output);
    return response.parsed_output;
  } catch (error) {
    return anthropicErrorResponse(error);
  }
}

async function generateRelevance(
  anthropic: Anthropic,
  item: IlluminateRequestItem,
  factSummary: string,
  bucket: PreferenceBucket
): Promise<RelevanceLayer | Response> {
  const cacheKey = relevanceCacheKey(item, bucket);
  const cached = relevanceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bucketLines: string[] = [];
  if (bucket.age !== 'unspecified') bucketLines.push(`age range: ${bucket.age}`);
  if (bucket.stance !== 'unspecified') bucketLines.push(`general political leaning: ${bucket.stance}`);
  if (bucket.region !== 'unspecified') bucketLines.push(`region: ${bucket.region}`);

  const readerContext = bucketLines.length > 0
    ? `Reader context: ${bucketLines.join(', ')}.`
    : `Reader context: unspecified - give a general, audience-agnostic explanation.`;

  const prompt = `Article summary: ${factSummary}

${readerContext}

Explain why this story is relevant to this reader and its potential impact, following the system rules above.`;

  try {
    const response = await anthropic.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      system: RELEVANCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: zodOutputFormat(RelevanceLayerSchema) },
    });

    if (!response.parsed_output) {
      return Response.json({ error: 'Claude relevance response did not match expected shape.' }, { status: 502 });
    }
    relevanceCache.set(cacheKey, response.parsed_output);
    return response.parsed_output;
  } catch (error) {
    return anthropicErrorResponse(error);
  }
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
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

  const { item, factSummary } = body;
  if (!item?.title || !item?.source?.name) {
    return Response.json({ error: 'item.title and item.source.name are required.' }, { status: 400 });
  }

  const needFact = body.needFact ?? true;
  const needRelevance = body.needRelevance ?? true;
  const bucket: PreferenceBucket = body.bucket ?? { age: 'unspecified', stance: 'unspecified', region: 'unspecified' };

  if (!needFact && !needRelevance) {
    return Response.json({ error: 'At least one of needFact or needRelevance must be true.' }, { status: 400 });
  }
  if (needRelevance && !needFact && !factSummary) {
    return Response.json(
      { error: 'factSummary is required when requesting relevance without also requesting fact.' },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey });

  let fact: FactLayer | undefined;
  if (needFact) {
    const result = await generateFact(anthropic, item);
    if (isResponse(result)) {
      return result;
    }
    fact = result;
  }

  let relevance: RelevanceLayer | undefined;
  if (needRelevance) {
    // Prefer the summary we just generated (this request) over the
    // client-supplied one, so the relevance framing never drifts from
    // stale cached facts when both are being (re)generated together.
    const summaryForContext = fact?.summary ?? factSummary!;
    const result = await generateRelevance(anthropic, item, summaryForContext, bucket);
    if (isResponse(result)) {
      return result;
    }
    relevance = result;
  }

  return Response.json({ fact, relevance });
}
