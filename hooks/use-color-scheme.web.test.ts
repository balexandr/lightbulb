import * as ReactNative from 'react-native';

import { renderHook } from '@testing-library/react-native';

import { useColorScheme } from './use-color-scheme.web';

describe('useColorScheme (web)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reflects the system color scheme once mounted', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    // The hydration effect runs synchronously within renderHook, so by the
    // time we read the result the real (mocked) scheme should be in effect.
    expect(result.current).toBe('dark');
  });

  it('reflects a light system scheme', () => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });
});
