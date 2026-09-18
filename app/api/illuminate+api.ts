import OpenAI from 'openai';

import { AIExplanation } from '@/types/news';
import { UserPreferences } from '@/services/preferencesService';

const OPENAI_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 800;

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

function isAIExplanation(value: unknown): value is AIExplanation {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AIExplanation).summary === 'string' &&
    typeof (value as AIExplanation).why === 'string' &&
    typeof (value as AIExplanation).impact === 'string' &&
    typeof (value as AIExplanation).credibility === 'string'
  );
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
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
4. Source credibility assessment

Format as JSON with keys: summary, why, impact, credibility`;

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a helpful news analyst who provides clear, balanced context about news stories. When user preferences are provided, tailor the "impact" section to be relevant to their perspective and demographic while remaining factual and unbiased in other sections. Focus on facts and verifiable information.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return Response.json({ error: 'No response from OpenAI.' }, { status: 502 });
    }

    const parsed = JSON.parse(content);
    if (!isAIExplanation(parsed)) {
      return Response.json({ error: 'OpenAI response did not match expected explanation shape.' }, { status: 502 });
    }

    return Response.json(parsed);
  } catch (error: any) {
    const status = error?.status === 429 ? 429 : 502;
    return Response.json({ error: error?.message ?? 'OpenAI request failed.' }, { status });
  }
}
