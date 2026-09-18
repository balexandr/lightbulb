import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { preferencesService } from '@/services/preferencesService';

import ExploreScreen from '@/app/(tabs)/explore';

jest.mock('@/services/preferencesService', () => ({
  preferencesService: {
    getPreferences: jest.fn(),
    savePreferences: jest.fn(),
  },
}));

const mockPreferencesService = preferencesService as jest.Mocked<typeof preferencesService>;

describe('ExploreScreen', () => {
  beforeEach(() => {
    mockPreferencesService.getPreferences.mockResolvedValue({});
    mockPreferencesService.savePreferences.mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads and reflects previously saved preferences', async () => {
    mockPreferencesService.getPreferences.mockResolvedValue({ politicalStandpoint: 'progressive', ageRange: '25-34' });

    render(<ExploreScreen />);

    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());
    expect(screen.getByText('Progressive')).toBeTruthy();
  });

  it('saves a political standpoint when an option is tapped', async () => {
    render(<ExploreScreen />);
    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Conservative'));

    await waitFor(() =>
      expect(mockPreferencesService.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ politicalStandpoint: 'conservative' })
      )
    );
  });

  it('deselects a political standpoint when tapped again', async () => {
    mockPreferencesService.getPreferences.mockResolvedValue({ politicalStandpoint: 'liberal' });
    render(<ExploreScreen />);
    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Liberal'));

    await waitFor(() =>
      expect(mockPreferencesService.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ politicalStandpoint: undefined })
      )
    );
  });

  it('saves an age range selection', async () => {
    render(<ExploreScreen />);
    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

    fireEvent.press(screen.getByText('45-54'));

    await waitFor(() =>
      expect(mockPreferencesService.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ ageRange: '45-54' })
      )
    );
  });
});
