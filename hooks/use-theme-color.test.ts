import { Colors } from '@/constants/theme';

import { useColorScheme } from './use-color-scheme';
import { useThemeColor } from './use-theme-color';

jest.mock('./use-color-scheme', () => ({
  useColorScheme: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.Mock;

describe('useThemeColor', () => {
  it('falls back to the light theme when the color scheme is null', () => {
    mockUseColorScheme.mockReturnValue(null);
    expect(useThemeColor({}, 'text')).toBe(Colors.light.text);
  });

  it('reads from the dark theme when the scheme is dark', () => {
    mockUseColorScheme.mockReturnValue('dark');
    expect(useThemeColor({}, 'background')).toBe(Colors.dark.background);
  });

  it('reads from the light theme when the scheme is light', () => {
    mockUseColorScheme.mockReturnValue('light');
    expect(useThemeColor({}, 'background')).toBe(Colors.light.background);
  });

  it('prefers an explicit prop color over the theme default', () => {
    mockUseColorScheme.mockReturnValue('light');
    expect(useThemeColor({ light: '#custom' }, 'background')).toBe('#custom');
  });

  it('ignores a prop for the scheme that is not active', () => {
    mockUseColorScheme.mockReturnValue('dark');
    expect(useThemeColor({ light: '#custom' }, 'background')).toBe(Colors.dark.background);
  });
});
