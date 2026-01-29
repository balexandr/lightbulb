import { NewsItem } from '@/types/news';
import axios from 'axios';
import { cacheService } from './cacheService';

interface AIExplanation {
  summary: string;
  why: string;
  impact: string;
  credibility: string;
}

class AIService {
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1/chat/completions';
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 2000; // 2 seconds between requests
  private useMockData: boolean = true; // Set to false when you have billing set up

  constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ OpenAI API key not found. Using mock data.');
      this.useMockData = true;
    }
  }

  private generateMockExplanation(item: NewsItem): AIExplanation {
    // Generate contextual mock data based on the article
    const source = item.source.name;
    
    return {
      summary: `This article from ${source} discusses: "${item.title}". While we cannot provide AI-generated analysis in demo mode, this appears to be a newsworthy story that covers important developments in its field.`,
      
      why: `Context: This story is being reported by ${source}, which suggests it's part of ongoing coverage in this area. The events described likely stem from recent developments, policy changes, or emerging trends. To understand the full context, consider the source, timing, and related news stories.`,
      
      impact: `Potential impact: News stories like this can affect public opinion, policy decisions, and individual choices. Depending on the topic, this could influence your understanding of current events, affect related markets or industries, or signal broader societal trends worth monitoring.`,
      
      credibility: `Source assessment: ${source} is ${this.getSourceCredibilityNote(source)}. As with all news sources, it's important to cross-reference major stories with multiple outlets and consider potential biases. Always verify important information from primary sources when possible.`,
    };
  }

  private getSourceCredibilityNote(sourceName: string): string {
    const lowerSource = sourceName.toLowerCase();
    
    if (lowerSource.includes('bbc')) {
      return 'a well-established international news organization known for editorial standards and fact-checking';
    }
    if (lowerSource.includes('npr')) {
      return 'a reputable public media organization known for in-depth reporting and editorial independence';
    }
    if (lowerSource.includes('ars technica')) {
      return 'a trusted technology news site known for technical accuracy and detailed analysis';
    }
    if (lowerSource.includes('reddit')) {
      return 'a community-driven platform where content quality varies. Always verify important information from primary sources';
    }
    if (lowerSource.includes('guardian')) {
      return 'a well-regarded international news outlet known for investigative journalism';
    }
    
    return 'a news source that should be evaluated on its track record, editorial standards, and fact-checking practices';
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async explainNews(item: NewsItem): Promise<AIExplanation> {
    // Check cache first
    const cached = await cacheService.getExplanation(item);
    if (cached) {
      console.log('💾 Using cached explanation');
      return cached;
    }

    // Use mock data if enabled or no API key
    if (this.useMockData || !this.apiKey) {
      console.log('📝 Using mock data for:', item.title);
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockExplanation = this.generateMockExplanation(item);
      
      // Cache mock data too
      await cacheService.saveExplanation(item, mockExplanation);
      
      return mockExplanation;
    }

    // Wait to respect rate limits
    await this.waitForRateLimit();

    const prompt = `Analyze this news article and provide a comprehensive breakdown:

Title: ${item.title}
Source: ${item.source.name}
URL: ${item.url}

Please provide:
1. SUMMARY: A brief 2-3 sentence summary of what this article is about
2. WHY: Explain the context and background - why is this happening? What led to this?
3. IMPACT: How does this affect the average reader? What are the potential consequences?
4. CREDIBILITY: Assess the source credibility. Is ${item.source.name} generally reliable? Any known biases?

Format your response as JSON with keys: summary, why, impact, credibility`;

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful news analyst that breaks down complex news stories into understandable explanations. Always respond with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 30000, // 30 second timeout
        }
      );

      const content = response.data.choices[0].message.content;
      const parsed = JSON.parse(content);

      const explanation: AIExplanation = {
        summary: parsed.summary || 'Unable to generate summary',
        why: parsed.why || 'Unable to explain context',
        impact: parsed.impact || 'Unable to assess impact',
        credibility: parsed.credibility || 'Unable to assess credibility',
      };

      // Cache the explanation
      await cacheService.saveExplanation(item, explanation);

      return explanation;
    } catch (error: any) {
      console.error('AI Service Error:', error);
      
      // Fall back to mock data on any error
      console.log('⚠️ AI request failed, using mock data instead');
      const mockExplanation = this.generateMockExplanation(item);
      
      // Cache the fallback too
      await cacheService.saveExplanation(item, mockExplanation);
      
      return mockExplanation;
    }
  }

  // Method to enable/disable mock data
  setUseMockData(useMock: boolean): void {
    this.useMockData = useMock;
    console.log(`Mock data ${useMock ? 'enabled' : 'disabled'}`);
  }

  // Get cache statistics
  async getCacheStats() {
    return await cacheService.getCacheStats();
  }

  // Clear cache
  async clearCache() {
    await cacheService.clearAllCache();
  }

  // Clear expired cache
  async clearExpiredCache() {
    return await cacheService.clearExpiredCache();
  }
}

export const aiService = new AIService();