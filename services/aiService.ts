import { AIExplanation, NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';
import { getApiBaseUrl } from '@/utils/networkUtils';

import { cacheService } from './cacheService';
import { preferencesService } from './preferencesService';

class AIService {
  async explainNews(item: NewsItem): Promise<AIExplanation> {
    // Check cache first
    logger.debug('Checking cache for', item.url);
    const cached = await cacheService.getExplanation(item);
    if (cached) {
      logger.success('Using cached explanation');
      return cached;
    }

    logger.info('No cache found, generating new explanation');

    try {
      const preferences = await preferencesService.getPreferences();

      const response = await fetch(`${getApiBaseUrl()}/api/illuminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: {
            title: item.title,
            domain: item.domain,
            source: { name: item.source.name },
          },
          preferences,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error ?? `Illuminate request failed (${response.status})`);
      }

      const explanation: AIExplanation = await response.json();
      await cacheService.setExplanation(item, explanation);

      logger.success('Generated and cached new explanation');
      return explanation;
    } catch (error: any) {
      logger.info('Falling back to mock explanation:', error.message);
      const mockExplanation = this.getMockExplanation(item);
      await cacheService.setExplanation(item, mockExplanation);
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