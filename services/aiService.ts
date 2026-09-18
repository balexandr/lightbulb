import { AIExplanation, FactLayer, NewsItem, RelevanceLayer } from '@/types/news';
import { logger } from '@/utils/logger';
import { getApiBaseUrl } from '@/utils/networkUtils';

import { cacheService } from './cacheService';
import { preferencesService } from './preferencesService';

interface IlluminateResponseBody {
  fact?: FactLayer;
  relevance?: RelevanceLayer;
}

class AIService {
  async explainNews(item: NewsItem): Promise<AIExplanation> {
    const preferences = await preferencesService.getPreferences();
    const bucket = preferencesService.getPreferenceBucket(preferences);

    logger.debug('Checking cache for', item.url);
    const { fact: cachedFact, relevance: cachedRelevance } = await cacheService.getExplanation(item, bucket);

    if (cachedFact && cachedRelevance) {
      logger.success('Using cached explanation');
      return { ...cachedFact, ...cachedRelevance };
    }

    const needFact = !cachedFact;
    const needRelevance = !cachedRelevance;
    logger.info(`Cache ${needFact ? 'miss' : 'hit'} on fact, ${needRelevance ? 'miss' : 'hit'} on relevance - requesting only what's missing`);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/illuminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            title: item.title,
            domain: item.domain,
            source: { name: item.source.name },
          },
          bucket,
          needFact,
          needRelevance,
          // Lets the server build the relevance prompt's context without
          // regenerating a fact it doesn't need to (§15.5).
          factSummary: cachedFact?.summary,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error ?? `Illuminate request failed (${response.status})`);
      }

      const result: IlluminateResponseBody = await response.json();
      const fact = result.fact ?? cachedFact;
      const relevance = result.relevance ?? cachedRelevance;

      if (!fact || !relevance) {
        throw new Error('Illuminate response was missing a layer that should have been present.');
      }

      if (result.fact) {
        await cacheService.setFact(item, result.fact);
      }
      if (result.relevance) {
        await cacheService.setRelevance(item, bucket, result.relevance);
      }

      logger.success('Generated and cached new explanation');
      return { ...fact, ...relevance };
    } catch (error: any) {
      logger.info('Falling back to mock explanation:', error.message);
      const mockExplanation = this.getMockExplanation(item);
      await cacheService.setFact(item, { summary: mockExplanation.summary, credibility: mockExplanation.credibility });
      await cacheService.setRelevance(item, bucket, { why: mockExplanation.why, impact: mockExplanation.impact });
      return mockExplanation;
    }
  }

  private getMockExplanation(item: NewsItem): AIExplanation {
    return {
      summary: `This is a developing story about "${item.title}". The article discusses recent events and their immediate implications for the affected parties and broader community.`,
      why: `This story is significant because it represents ongoing trends in ${item.domain || 'current events'}. Understanding the context helps readers grasp the broader implications and how this might affect related issues.`,
      impact: `The potential impact includes short-term effects on stakeholders and possible long-term changes in policy or public perception. Experts suggest monitoring how this develops over the coming weeks.`,
      credibility: this.getSourceCredibilityNote(item.source.name),
    };
  }

  private getSourceCredibilityNote(sourceName: string): string {
    const credibilityNotes: Record<string, string> = {
      'BBC': 'BBC is a well-established public broadcaster with strong editorial standards and fact-checking processes.',
      'NPR': 'NPR is known for in-depth reporting and maintains high journalistic standards with transparent corrections policy.',
      'Reuters': 'Reuters is a trusted international news agency known for factual, unbiased reporting.',
      'AP News': 'Associated Press is one of the most reliable news sources with strict fact-checking protocols.',
      'Ars Technica': 'Ars Technica specializes in technology news with technically knowledgeable journalists.',
      'TechCrunch': 'TechCrunch focuses on technology and startup news, generally reliable for tech industry coverage.',
    };

    if (sourceName.startsWith('r/')) {
      return 'Reddit posts represent community discussions. Always verify claims through primary sources.';
    }

    return credibilityNotes[sourceName] ||
      'This source should be cross-referenced with other reputable news outlets for verification.';
  }
}

export const aiService = new AIService();
