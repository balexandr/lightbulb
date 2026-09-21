import { fireEvent, render, screen } from '@testing-library/react-native';

import { FilterMenu } from './FilterMenu';

function renderMenu(overrides: Partial<React.ComponentProps<typeof FilterMenu>> = {}) {
  const props = {
    visible: true,
    onClose: jest.fn(),
    rssSources: ['BBC', 'NPR'],
    redditSources: ['r/worldnews'],
    selectedSources: new Set(['BBC']),
    onToggleSource: jest.fn(),
    onSelectAll: jest.fn(),
    onClearAll: jest.fn(),
    ...overrides,
  };
  render(<FilterMenu {...props} />);
  return props;
}

describe('FilterMenu', () => {
  it('lists RSS and Reddit sources under their own sections', () => {
    renderMenu();

    expect(screen.getByText('📰 News Outlets')).toBeTruthy();
    expect(screen.getByText('Reddit Communities')).toBeTruthy();
    expect(screen.getByText('BBC')).toBeTruthy();
    expect(screen.getByText('NPR')).toBeTruthy();
    expect(screen.getByText('r/worldnews')).toBeTruthy();
  });

  it('omits a section entirely when it has no sources', () => {
    renderMenu({ redditSources: [] });
    expect(screen.queryByText('Reddit Communities')).toBeNull();
  });

  it('calls onToggleSource with the tapped source name', () => {
    const props = renderMenu();
    fireEvent.press(screen.getByText('NPR'));
    expect(props.onToggleSource).toHaveBeenCalledWith('NPR');
  });

  it('calls onSelectAll and onClearAll from their buttons', () => {
    const props = renderMenu();
    fireEvent.press(screen.getByText('Select All'));
    fireEvent.press(screen.getByText('Clear All'));
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
    expect(props.onClearAll).toHaveBeenCalledTimes(1);
  });

  it('calls onClose from the close button and the apply button', () => {
    const props = renderMenu();
    fireEvent.press(screen.getByText('✕'));
    fireEvent.press(screen.getByText('Apply Filter'));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  describe('source trust signals (§17.2)', () => {
    it('shows the methodology note explaining these are signals, not a score', () => {
      renderMenu();
      expect(screen.getByText(/not a single trust score/)).toBeTruthy();
    });

    it('shows outlet type and checklist for a known source', () => {
      renderMenu({ rssSources: ['BBC'] });
      expect(screen.getByText(/Public broadcaster.*corrections policy.*bylined/)).toBeTruthy();
    });

    it('describes a link aggregator differently from a newsroom', () => {
      renderMenu({ rssSources: ['Hacker News'] });
      expect(screen.getByText(/Link aggregator.*no editorial process of its own/)).toBeTruthy();
    });

    it('renders gracefully for a source with no matching trust data', () => {
      expect(() => renderMenu({ rssSources: ['Some Unlisted Source'] })).not.toThrow();
      expect(screen.getByText('Some Unlisted Source')).toBeTruthy();
    });
  });

  describe('hyperlocal layer (§17.4)', () => {
    it('groups a source tagged with a local region into its own section, separate from national outlets', () => {
      renderMenu({ rssSources: ['BBC', 'WHYY'] });

      expect(screen.getByText('📍 Local News')).toBeTruthy();
      expect(screen.getByText('Philadelphia, PA')).toBeTruthy();
      // WHYY appears once, under Local News, not duplicated under News Outlets.
      expect(screen.getAllByText('WHYY')).toHaveLength(1);
      expect(screen.getByText('BBC')).toBeTruthy();
    });

    it('omits the Local News section when no local sources are present', () => {
      renderMenu({ rssSources: ['BBC', 'NPR'] });
      expect(screen.queryByText('📍 Local News')).toBeNull();
    });

    it('still toggles a local source like any other source', () => {
      const props = renderMenu({ rssSources: ['WHYY'] });
      fireEvent.press(screen.getByText('WHYY'));
      expect(props.onToggleSource).toHaveBeenCalledWith('WHYY');
    });
  });
});
