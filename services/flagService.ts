import { PreferenceBucket } from '@/services/preferencesService';
import { getApiBaseUrl } from '@/utils/networkUtils';

// §18.5 - kept to exactly what the guide's payload calls for: no free-form
// reason text as the primary signal, just this fixed set so flags stay easy
// to tally later.
export type FlagReason = 'wrong' | 'off' | 'too_persuasive';

interface FlagSubmission {
  url: string;
  bucket: PreferenceBucket;
  flaggedField: FlagReason;
  freeText?: string;
}

class FlagService {
  async submitFlag(submission: FlagSubmission): Promise<void> {
    const response = await fetch(`${getApiBaseUrl()}/api/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error ?? `Flag submission failed (${response.status})`);
    }
  }
}

export const flagService = new FlagService();
