import AsyncStorage from '@react-native-async-storage/async-storage';

import { preferencesService } from './preferencesService';

describe('PreferencesService', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns an empty object when nothing has been saved', async () => {
    expect(await preferencesService.getPreferences()).toEqual({});
  });

  it('saves and reloads preferences', async () => {
    await preferencesService.savePreferences({ politicalStandpoint: 'moderate', ageRange: '25-34' });
    expect(await preferencesService.getPreferences()).toEqual({
      politicalStandpoint: 'moderate',
      ageRange: '25-34',
    });
  });

  it('updates a single preference without clobbering the others', async () => {
    await preferencesService.savePreferences({ politicalStandpoint: 'moderate' });
    await preferencesService.updatePreference('ageRange', '35-44');

    expect(await preferencesService.getPreferences()).toEqual({
      politicalStandpoint: 'moderate',
      ageRange: '35-44',
    });
  });

  it('clears all preferences', async () => {
    await preferencesService.savePreferences({ politicalStandpoint: 'moderate' });
    await preferencesService.clearPreferences();

    expect(await preferencesService.getPreferences()).toEqual({});
  });

  it('returns an empty object if the stored value is corrupted JSON', async () => {
    await AsyncStorage.setItem('@lightbulb_user_preferences', 'not-json');
    expect(await preferencesService.getPreferences()).toEqual({});
  });
});
