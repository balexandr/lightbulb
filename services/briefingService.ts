import { cacheService } from '@/services/cacheService';
import { PreferenceBucket } from '@/services/preferencesService';
import { NewsItem } from '@/types/news';
import { getApiBaseUrl } from '@/utils/networkUtils';

interface BriefingResponseBody {
  script: string;
}

class BriefingService {
  // Reuses whatever fact summaries are already cached client-side (from
  // prior Illuminate taps) so the server doesn't re-derive facts for
  // stories the user has already looked at (§17.3).
  async getScript(items: NewsItem[], bucket: PreferenceBucket): Promise<string> {
    const requestItems = await Promise.all(
      items.map(async item => {
        const fact = await cacheService.getFact(item);
        return {
          title: item.title,
          source: { name: item.source.name },
          domain: item.domain,
          cachedSummary: fact?.summary,
        };
      })
    );

    const response = await fetch(`${getApiBaseUrl()}/api/briefing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: requestItems, bucket }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error ?? `Briefing request failed (${response.status})`);
    }

    const result: BriefingResponseBody = await response.json();
    return result.script;
  }
}

export const briefingService = new BriefingService();
