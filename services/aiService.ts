import OpenAI from 'openai';

import { API_CONFIG } from '@/constants/newsConfig';
import { NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';

type AIExplanation = {
  summary: string;
  why: string;
  impact: string;
  credibility: string;
};

import { cacheService } from './cacheService';

class AIService {
  private openai: OpenAI | null = null;
  private lastRequestTime = 0;

  constructor() {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (apiKey) {
      this.openai = new OpenAI({
        apiKey,
      });
      logger.info('OpenAI client initialized');
    } else {
      logger.warn('OpenAI API key not found, using mock data');
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < API_CONFIG.RATE_LIMIT_MS) {
      const waitTime = API_CONFIG.RATE_LIMIT_MS - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async explainNews(item: NewsItem): Promise<AIExplanation> {
    // Check cache first
    logger.debug('Checking cache for', item.url);
    const cached = await cacheService.getExplanation(item);
    if (cached) {
      logger.success('Using cached explanation');
      return cached;
    }
    
    logger.info('No cache found, generating new explanation');

    if (!this.openai) {
      logger.info('Using mock explanation (no API key)');
      const mockExplanation = this.getMockExplanation(item);
      // Cache the mock explanation too
      await cacheService.setExplanation(item, mockExplanation);
      return mockExplanation;
    }

    try {
      await this.rateLimit();
      
      const prompt = `Analyze this news headline and provide context:

Title: ${item.title}
Source: ${item.source.name}
${item.domain ? `Domain: ${item.domain}` : ''}

Please provide:
1. A brief summary (2-3 sentences)
2. Why this matters (context and background)
3. Potential impact or implications
4. Source credibility assessment

Format as JSON with keys: summary, why, impact, credibility`;

      const response = await this.openai.chat.completions.create({
        model: API_CONFIG.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful news analyst who provides clear, unbiased context about news stories. Focus on facts and verifiable information.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: API_CONFIG.MAX_TOKENS,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const explanation = JSON.parse(content);
      await cacheService.setExplanation(item, explanation);
      
      logger.success('Generated and cached new explanation');
      return explanation;
    } catch (error: any) {
      // Only log if it's not a quota error
      if (!error.message?.includes('quota')) {
        logger.error('Error calling OpenAI:', error.message);
      } else {
        logger.info('OpenAI quota exceeded, using mock data');
      }
      const mockExplanation = this.getMockExplanation(item);
      // Cache the mock explanation so we don't keep hitting the API
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