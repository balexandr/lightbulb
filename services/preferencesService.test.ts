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

describe('getPreferenceBucket', () => {
  it('buckets unset preferences as unspecified across the board', () => {
    expect(preferencesService.getPreferenceBucket({})).toEqual({
      age: 'unspecified',
      stance: 'unspecified',
      region: 'unspecified',
    });
  });

  it('passes through age and stance as-is, since they are already small fixed enums', () => {
    expect(
      preferencesService.getPreferenceBucket({ ageRange: '25-34', politicalStandpoint: 'progressive' })
    ).toEqual({
      age: '25-34',
      stance: 'progressive',
      region: 'unspecified',
    });
  });

  it('ignores gender - not part of the bucket', () => {
    expect(preferencesService.getPreferenceBucket({ gender: 'nonbinary' })).toEqual({
      age: 'unspecified',
      stance: 'unspecified',
      region: 'unspecified',
    });
  });

  it('passes location through as the region bucket (§17.4)', () => {
    expect(preferencesService.getPreferenceBucket({ location: 'philadelphia' })).toEqual({
      age: 'unspecified',
      stance: 'unspecified',
      region: 'philadelphia',
    });
  });
});
