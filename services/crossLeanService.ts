import AsyncStorage from '@react-native-async-storage/async-storage';

import { LeanTag } from '@/constants/newsConfig';
import { StanceBucket } from '@/services/preferencesService';
import { logger } from '@/utils/logger';

// §17.7 "read across the aisle" streak - deliberately built with a leash:
// strictly descriptive (a count, nothing scored or ranked), no leaderboard,
// no push notification, no framing implying it's more virtuous to do this
// than not. See docs/TECHNICAL_GUIDE.md §17.7 before changing the framing.

const STORAGE_KEY = '@lightbulb_cross_lean';

type Side = 'left' | 'center' | 'right';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function stanceToSide(stance: StanceBucket): Side | null {
  switch (stance) {
    case 'progressive':
    case 'liberal':
      return 'left';
    case 'moderate':
      return 'center';
    case 'conservative':
      return 'right';
    // Libertarian doesn't map cleanly onto a left/center/right axis - this
    // reduction is only for the coarse §17.7 comparison, not a claim about
    // libertarian politics generally.
    case 'libertarian':
      return 'right';
    case 'unspecified':
      return null;
  }
}

function leanToSide(lean: LeanTag): Side | null {
  switch (lean) {
    case 'left-leaning':
      return 'left';
    case 'right-leaning':
      return 'right';
    case 'center':
      return 'center';
    case 'not-applicable':
      return null;
  }
}

interface CrossLeanStore {
  month: string; // 'YYYY-MM' - rolls over automatically, no history retained
  sources: string[]; // distinct source names opened this month with a different lean
}

export class CrossLeanService {
  // Call whenever an article is opened. No-ops when the reader hasn't set a
  // stance preference, or the source isn't tagged as general political-news
  // editorial content (§17.7's `not-applicable` sources never count).
  async recordOpen(stance: StanceBucket, sourceName: string, sourceLean: LeanTag): Promise<void> {
    const ownSide = stanceToSide(stance);
    const sourceSide = leanToSide(sourceLean);
    if (ownSide === null || sourceSide === null || ownSide === sourceSide) {
      return;
    }

    const store = await this.getStore();
    if (!store.sources.includes(sourceName)) {
      store.sources.push(sourceName);
      await this.saveStore(store);
    }
  }

  async getMonthlyCount(): Promise<number> {
    const store = await this.getStore();
    return store.sources.length;
  }

  private async getStore(): Promise<CrossLeanStore> {
    const month = currentMonth();
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: CrossLeanStore | null = raw ? JSON.parse(raw) : null;
      if (!parsed || parsed.month !== month) {
        return { month, sources: [] };
      }
      return parsed;
    } catch (error) {
      logger.error('Error loading cross-lean tracking:', error);
      return { month, sources: [] };
    }
  }

  private async saveStore(store: CrossLeanStore): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      logger.error('Error saving cross-lean tracking:', error);
    }
  }
}

export const crossLeanService = new CrossLeanService();
