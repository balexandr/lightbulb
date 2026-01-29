import OpenAI from 'openai';

import { API_CONFIG } from '@/constants/newsConfig';
import { AIExplanation, NewsItem } from '@/types/news';
import { logger } from '@/utils/logger';

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
    const cached = await cacheService.getExplanation(item);
    if (cached) {
      return cached;
    }

    if (!this.openai) {
      logger.info('Using mock explanation (no API key)');
      return this.getMockExplanation(item);
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
      
      return explanation;
    } catch (error: any) {
      logger.error('Error calling OpenAI:', error.message);
      return this.getMockExplanation(item);
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