import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { logger } from '@/utils/logger';

// §16.3 #2: a daily digest nudge, built as an on-device scheduled local
// notification - no server, no push tokens, no accounts. Deliberately
// generic content ("your briefing is ready"), not a real headline: this is
// scheduled once and fires on-device with no network access at that
// moment, so it can't know what's actually in today's feed without a
// background-fetch pipeline this app doesn't have. Tapping it just opens
// the app, where the real (already-built) news feed and audio briefing
// (§17.3) take over.
const ENABLED_KEY = '@lightbulb_daily_digest_enabled';
const DIGEST_HOUR = 8;
const DIGEST_MINUTE = 0;
const ANDROID_CHANNEL_ID = 'daily-digest';

// 'ok' covers both directions - the requested on/off state was applied
// successfully. Only enabling can actually fail (permission or platform).
export type SetDigestOutcome = 'ok' | 'permission-denied' | 'unsupported';

// Local scheduled notifications don't have official web support (Expo's
// own guidance: web push isn't supported, and this API's web behavior is
// unofficial/partial) - native-only, same platform split as expo-speech's
// briefing playback (§17.3).
function isSupported(): boolean {
  return Platform.OS !== 'web';
}

// Required once, before any notification can display - without it,
// foreground delivery silently does nothing on some platforms. Safe to
// call at module load since it only registers a handler, no permission
// prompt or user-visible effect happens here.
if (isSupported()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

class NotificationService {
  isSupported(): boolean {
    return isSupported();
  }

  async isDailyDigestEnabled(): Promise<boolean> {
    const stored = await AsyncStorage.getItem(ENABLED_KEY);
    return stored === 'true';
  }

  async setDailyDigestEnabled(enabled: boolean): Promise<SetDigestOutcome> {
    if (!isSupported()) {
      return 'unsupported';
    }

    if (!enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.setItem(ENABLED_KEY, 'false');
      return 'ok';
    }

    const granted = await this.requestPermission();
    if (!granted) {
      await AsyncStorage.setItem(ENABLED_KEY, 'false');
      return 'permission-denied';
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Daily digest',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Cancel first so re-enabling (or changing the time, in the future)
    // never stacks a second daily trigger alongside the old one.
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📰 Your daily briefing is ready',
        body: "Open Lightbulb to catch up on what's happening today.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: DIGEST_HOUR,
        minute: DIGEST_MINUTE,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
      },
    });

    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    return 'ok';
  }

  private async requestPermission(): Promise<boolean> {
    try {
      const existing = await Notifications.getPermissionsAsync();
      if (existing.granted) {
        return true;
      }
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
