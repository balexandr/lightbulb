import { fireEvent, render, screen } from '@testing-library/react-native';

import { IlluminateModal } from './IlluminateModal';

const explanation = {
  summary: 'The summary.',
  why: 'The why.',
  impact: 'The impact.',
  credibility: 'The credibility note.',
};

describe('IlluminateModal', () => {
  it('shows a loading indicator while loading', () => {
    render(<IlluminateModal visible title="A headline" loading onClose={jest.fn()} />);
    expect(screen.getByText('Illuminating this story...')).toBeTruthy();
    expect(screen.queryByText('The summary.')).toBeNull();
  });

  it('renders every section of the explanation once loaded', () => {
    render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} />);

    expect(screen.getByText('The summary.')).toBeTruthy();
    expect(screen.getByText('The why.')).toBeTruthy();
    expect(screen.getByText('The impact.')).toBeTruthy();
    expect(screen.getByText('The credibility note.')).toBeTruthy();
  });

  it('shows the cache badge only when fromCache is true and not loading', () => {
    render(<IlluminateModal visible title="A headline" explanation={explanation} fromCache onClose={jest.fn()} />);
    expect(screen.getByText('💾 Cached explanation')).toBeTruthy();
  });

  it('hides the cache badge while still loading', () => {
    render(<IlluminateModal visible title="A headline" loading fromCache onClose={jest.fn()} />);
    expect(screen.queryByText('💾 Cached explanation')).toBeNull();
  });

  it('shows an error state when there is no explanation and it is not loading', () => {
    render(<IlluminateModal visible title="A headline" onClose={jest.fn()} />);
    expect(screen.getByText('Unable to generate explanation. Please try again.')).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={onClose} />);

    fireEvent.press(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
