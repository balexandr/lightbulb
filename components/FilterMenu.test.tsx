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
});
