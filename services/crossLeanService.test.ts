import AsyncStorage from '@react-native-async-storage/async-storage';

import { CrossLeanService } from './crossLeanService';

describe('CrossLeanService', () => {
  let crossLeanService: InstanceType<typeof CrossLeanService>;

  beforeEach(async () => {
    await AsyncStorage.clear();
    crossLeanService = new CrossLeanService();
  });

  it('returns 0 when nothing has been recorded', async () => {
    expect(await crossLeanService.getMonthlyCount()).toBe(0);
  });

  it('does not count an open when the reader has no stance preference set', async () => {
    await crossLeanService.recordOpen('unspecified', 'The Guardian', 'left-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(0);
  });

  it('does not count an open from a source tagged not-applicable', async () => {
    await crossLeanService.recordOpen('conservative', 'Ars Technica', 'not-applicable');
    expect(await crossLeanService.getMonthlyCount()).toBe(0);
  });

  it('does not count an open matching the reader’s own side', async () => {
    await crossLeanService.recordOpen('progressive', 'The Guardian', 'left-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(0);
  });

  it('counts a left-leaning reader opening a right-leaning source', async () => {
    await crossLeanService.recordOpen('liberal', 'A Right Outlet', 'right-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(1);
  });

  it('counts a right-leaning reader opening a left-leaning source', async () => {
    await crossLeanService.recordOpen('conservative', 'NYTimes', 'left-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(1);
  });

  it('counts a moderate reader opening any non-center source as different', async () => {
    await crossLeanService.recordOpen('moderate', 'NYTimes', 'left-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(1);
  });

  it('counts a libertarian reader opening a left-leaning source, using the right-side reduction', async () => {
    await crossLeanService.recordOpen('libertarian', 'NYTimes', 'left-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(1);
  });

  it('counts distinct sources only once, even across repeated opens', async () => {
    await crossLeanService.recordOpen('progressive', 'A Right Outlet', 'right-leaning');
    await crossLeanService.recordOpen('progressive', 'A Right Outlet', 'right-leaning');
    await crossLeanService.recordOpen('progressive', 'A Right Outlet', 'right-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(1);
  });

  it('counts multiple distinct different-leaning sources', async () => {
    await crossLeanService.recordOpen('progressive', 'Outlet A', 'right-leaning');
    await crossLeanService.recordOpen('progressive', 'Outlet B', 'right-leaning');
    await crossLeanService.recordOpen('progressive', 'Outlet C', 'right-leaning');
    expect(await crossLeanService.getMonthlyCount()).toBe(3);
  });

  it('resets the count when the stored data is from a previous month', async () => {
    await AsyncStorage.setItem('@lightbulb_cross_lean', JSON.stringify({ month: '2020-01', sources: ['Old Outlet'] }));
    expect(await crossLeanService.getMonthlyCount()).toBe(0);
  });

  it('returns 0 when the stored value is corrupted JSON', async () => {
    await AsyncStorage.setItem('@lightbulb_cross_lean', 'not-json');
    expect(await crossLeanService.getMonthlyCount()).toBe(0);
  });
});
