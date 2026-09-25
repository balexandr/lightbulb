import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationService } from './notificationService';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  AndroidImportance: { DEFAULT: 3 },
}));

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe('NotificationService', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'ios';
    mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: false } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: true } as any);
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('notif-id');
  });

  afterEach(async () => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('isSupported', () => {
    it('is supported on iOS and Android', () => {
      Platform.OS = 'ios';
      expect(notificationService.isSupported()).toBe(true);
      Platform.OS = 'android';
      expect(notificationService.isSupported()).toBe(true);
    });

    it('is not supported on web', () => {
      Platform.OS = 'web';
      expect(notificationService.isSupported()).toBe(false);
    });
  });

  describe('isDailyDigestEnabled', () => {
    it('defaults to false when nothing has been saved', async () => {
      await expect(notificationService.isDailyDigestEnabled()).resolves.toBe(false);
    });
  });

  describe('setDailyDigestEnabled(true)', () => {
    it('requests permission, schedules a daily trigger, and persists the enabled state', async () => {
      const outcome = await notificationService.setDailyDigestEnabled(true);

      expect(outcome).toBe('ok');
      expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
      expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({ type: 'daily', hour: 8, minute: 0 }),
        })
      );
      await expect(notificationService.isDailyDigestEnabled()).resolves.toBe(true);
    });

    it('does not re-request permission if already granted', async () => {
      mockNotifications.getPermissionsAsync.mockResolvedValue({ granted: true } as any);

      await notificationService.setDailyDigestEnabled(true);

      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('sets up an Android notification channel only on Android', async () => {
      Platform.OS = 'android';

      await notificationService.setDailyDigestEnabled(true);

      expect(mockNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'daily-digest',
        expect.objectContaining({ importance: 3 })
      );
    });

    it('does not set up a notification channel on iOS', async () => {
      await notificationService.setDailyDigestEnabled(true);
      expect(mockNotifications.setNotificationChannelAsync).not.toHaveBeenCalled();
    });

    it('returns "permission-denied" and stays disabled when the user declines', async () => {
      mockNotifications.requestPermissionsAsync.mockResolvedValue({ granted: false } as any);

      const outcome = await notificationService.setDailyDigestEnabled(true);

      expect(outcome).toBe('permission-denied');
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      await expect(notificationService.isDailyDigestEnabled()).resolves.toBe(false);
    });

    it('returns "unsupported" on web without touching permissions or scheduling', async () => {
      Platform.OS = 'web';

      const outcome = await notificationService.setDailyDigestEnabled(true);

      expect(outcome).toBe('unsupported');
      expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('setDailyDigestEnabled(false)', () => {
    it('cancels any scheduled notification and persists the disabled state', async () => {
      await notificationService.setDailyDigestEnabled(true);
      mockNotifications.cancelAllScheduledNotificationsAsync.mockClear();

      const outcome = await notificationService.setDailyDigestEnabled(false);

      expect(outcome).toBe('ok');
      expect(mockNotifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
      await expect(notificationService.isDailyDigestEnabled()).resolves.toBe(false);
    });
  });
});
