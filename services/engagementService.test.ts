import AsyncStorage from '@react-native-async-storage/async-storage';

import { EngagementService } from './engagementService';

describe('EngagementService', () => {
  let engagementService: EngagementService;

  beforeEach(async () => {
    await AsyncStorage.clear();
    engagementService = new EngagementService();
  });

  it('returns no scores when nothing has been recorded', async () => {
    expect(await engagementService.getEngagementScores()).toEqual({});
  });

  it('does not score a source until it has at least 3 recorded sessions', async () => {
    await engagementService.recordIlluminateSession('BBC', 10_000);
    await engagementService.recordIlluminateSession('BBC', 10_000);

    expect(await engagementService.getEngagementScores()).toEqual({});
  });

  it('scores a source as the ratio of full reads to total opens once there is enough sample', async () => {
    await engagementService.recordIlluminateSession('BBC', 10_000); // full read
    await engagementService.recordIlluminateSession('BBC', 10_000); // full read
    await engagementService.recordIlluminateSession('BBC', 1_000); // quick dismissal

    const scores = await engagementService.getEngagementScores();
    expect(scores.BBC).toBeCloseTo(2 / 3);
  });

  it('treats a session at or above the threshold as a full read, and below it as a quick dismissal', async () => {
    await engagementService.recordIlluminateSession('NPR', 8_000);
    await engagementService.recordIlluminateSession('NPR', 7_999);
    await engagementService.recordIlluminateSession('NPR', 8_000);

    const scores = await engagementService.getEngagementScores();
    expect(scores.NPR).toBeCloseTo(2 / 3);
  });

  it('tracks each source independently', async () => {
    await engagementService.recordIlluminateSession('BBC', 10_000);
    await engagementService.recordIlluminateSession('BBC', 10_000);
    await engagementService.recordIlluminateSession('BBC', 10_000);
    await engagementService.recordIlluminateSession('TechCrunch', 500);
    await engagementService.recordIlluminateSession('TechCrunch', 500);
    await engagementService.recordIlluminateSession('TechCrunch', 500);

    const scores = await engagementService.getEngagementScores();
    expect(scores.BBC).toBe(1);
    expect(scores.TechCrunch).toBe(0);
  });

  it('clears all recorded engagement data', async () => {
    await engagementService.recordIlluminateSession('BBC', 10_000);
    await engagementService.recordIlluminateSession('BBC', 10_000);
    await engagementService.recordIlluminateSession('BBC', 10_000);

    await engagementService.clear();

    expect(await engagementService.getEngagementScores()).toEqual({});
  });

  it('returns no scores when the stored value is corrupted JSON', async () => {
    await AsyncStorage.setItem('@lightbulb_engagement', 'not-json');
    expect(await engagementService.getEngagementScores()).toEqual({});
  });
});
