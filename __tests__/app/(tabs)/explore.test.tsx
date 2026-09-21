import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { crossLeanService } from '@/services/crossLeanService';
import { preferencesService } from '@/services/preferencesService';

import ExploreScreen from '@/app/(tabs)/explore';

jest.mock('@/services/preferencesService', () => ({
  preferencesService: {
    getPreferences: jest.fn(),
    savePreferences: jest.fn(),
  },
}));

jest.mock('@/services/crossLeanService', () => ({
  crossLeanService: { getMonthlyCount: jest.fn() },
}));

const mockPreferencesService = preferencesService as jest.Mocked<typeof preferencesService>;
const mockCrossLeanService = crossLeanService as jest.Mocked<typeof crossLeanService>;

describe('ExploreScreen', () => {
  beforeEach(() => {
    mockPreferencesService.getPreferences.mockResolvedValue({});
    mockPreferencesService.savePreferences.mockResolvedValue();
    mockCrossLeanService.getMonthlyCount.mockResolvedValue(0);
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

  it('saves a location selection', async () => {
    render(<ExploreScreen />);
    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Philadelphia, PA'));

    await waitFor(() =>
      expect(mockPreferencesService.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ location: 'philadelphia' })
      )
    );
  });

  it('deselects a location when tapped again', async () => {
    mockPreferencesService.getPreferences.mockResolvedValue({ location: 'philadelphia' });
    render(<ExploreScreen />);
    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

    fireEvent.press(screen.getByText('Philadelphia, PA'));

    await waitFor(() =>
      expect(mockPreferencesService.savePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ location: undefined })
      )
    );
  });

  describe('"read across the aisle" count (§17.7)', () => {
    it('does not show the count when no political standpoint is set', async () => {
      render(<ExploreScreen />);
      await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

      expect(screen.queryByText(/differently-leaning/)).toBeNull();
    });

    it('shows a zero-state message when a standpoint is set but nothing has been read yet', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({ politicalStandpoint: 'progressive' });
      render(<ExploreScreen />);

      await waitFor(() =>
        expect(screen.getByText("You haven't read from a differently-leaning source this month.")).toBeTruthy()
      );
    });

    it('shows the tracked count as a plain, non-scored sentence', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({ politicalStandpoint: 'conservative' });
      mockCrossLeanService.getMonthlyCount.mockResolvedValue(3);
      render(<ExploreScreen />);

      await waitFor(() =>
        expect(screen.getByText("You've read from 3 differently-leaning sources this month.")).toBeTruthy()
      );
    });

    it('uses singular phrasing for a count of exactly one', async () => {
      mockPreferencesService.getPreferences.mockResolvedValue({ politicalStandpoint: 'moderate' });
      mockCrossLeanService.getMonthlyCount.mockResolvedValue(1);
      render(<ExploreScreen />);

      await waitFor(() =>
        expect(screen.getByText("You've read from 1 differently-leaning source this month.")).toBeTruthy()
      );
    });
  });

  it('links to the Privacy Policy and Terms of Service', async () => {
    render(<ExploreScreen />);
    await waitFor(() => expect(mockPreferencesService.getPreferences).toHaveBeenCalled());

    expect(screen.getByText('Privacy Policy')).toBeTruthy();
    expect(screen.getByText('Terms of Service')).toBeTruthy();
  });
});
