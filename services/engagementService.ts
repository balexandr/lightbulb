import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

// §18.2 "cheap MVP": client-only, per-device, no cross-user aggregation -
// the guide is explicit that the full (server-side, cross-user) version
// needs the backend/analytics infrastructure this project doesn't have
// yet (§16.2), so this only ever uses one device's own history to
// lightly re-rank what surfaces for that same device.

interface SourceEngagement {
  totalOpens: number;
  fullReads: number;
}

type EngagementStore = Record<string, SourceEngagement>;

const ENGAGEMENT_KEY = '@lightbulb_engagement';
// How long the explanation has to stay on screen to count as "read", not
// "dismissed quickly". A rough heuristic, not a scroll/attention tracker.
const FULL_READ_THRESHOLD_MS = 8000;
// Don't weight a source until there's enough signal to mean something -
// one quick dismissal shouldn't be enough to bury a source.
const MIN_SAMPLE_SIZE = 3;

export class EngagementService {
  async recordIlluminateSession(sourceName: string, dwellMs: number): Promise<void> {
    try {
      const store = await this.getStore();
      const current = store[sourceName] ?? { totalOpens: 0, fullReads: 0 };
      current.totalOpens += 1;
      if (dwellMs >= FULL_READ_THRESHOLD_MS) {
        current.fullReads += 1;
      }
      store[sourceName] = current;
      await AsyncStorage.setItem(ENGAGEMENT_KEY, JSON.stringify(store));
    } catch (error) {
      logger.error('Error recording engagement:', error);
    }
  }

  // A ratio in [0, 1] per source with enough samples - 0.5 (neutral) is
  // implied for everything else by the caller, not returned here, so the
  // ranking step can tell "no opinion yet" apart from "genuinely neutral".
  async getEngagementScores(): Promise<Record<string, number>> {
    const store = await this.getStore();
    const scores: Record<string, number> = {};

    for (const [source, data] of Object.entries(store)) {
      if (data.totalOpens >= MIN_SAMPLE_SIZE) {
        scores[source] = data.fullReads / data.totalOpens;
      }
    }

    return scores;
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ENGAGEMENT_KEY);
    } catch (error) {
      logger.error('Error clearing engagement data:', error);
    }
  }

  private async getStore(): Promise<EngagementStore> {
    try {
      const stored = await AsyncStorage.getItem(ENGAGEMENT_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      logger.error('Error loading engagement data:', error);
      return {};
    }
  }
}

export const engagementService = new EngagementService();
