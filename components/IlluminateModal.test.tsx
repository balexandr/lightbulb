import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
    expect(screen.getByText('Cached explanation')).toBeTruthy();
  });

  it('hides the cache badge while still loading', () => {
    render(<IlluminateModal visible title="A headline" loading fromCache onClose={jest.fn()} />);
    expect(screen.queryByText('Cached explanation')).toBeNull();
  });

  it('shows an error state when there is no explanation and it is not loading', () => {
    render(<IlluminateModal visible title="A headline" onClose={jest.fn()} />);
    expect(screen.getByText('Unable to generate explanation. Please try again.')).toBeTruthy();
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={onClose} />);

    fireEvent.press(screen.UNSAFE_getByProps({ name: 'close' }).parent);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('"flag this explanation" (§18.5)', () => {
    it('does not show the flag affordance when onFlag is not provided', () => {
      render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} />);
      expect(screen.queryByText('Flag this explanation')).toBeNull();
    });

    it('opens a reason picker when the flag affordance is tapped', () => {
      render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} onFlag={jest.fn()} />);

      fireEvent.press(screen.getByText('Flag this explanation'));

      expect(screen.getByText('Wrong')).toBeTruthy();
      expect(screen.getByText('Off')).toBeTruthy();
      expect(screen.getByText('Too persuasive')).toBeTruthy();
    });

    it('disables submit until a reason is selected', () => {
      render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} onFlag={jest.fn()} />);

      fireEvent.press(screen.getByText('Flag this explanation'));
      fireEvent.press(screen.getByText('Submit flag'));

      expect(screen.getByText('Submit flag')).toBeTruthy();
      expect(screen.queryByText('Thanks — this has been flagged.')).toBeNull();
    });

    it('submits the selected reason and optional free text, then shows a confirmation', async () => {
      const onFlag = jest.fn().mockResolvedValue(undefined);
      render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} onFlag={onFlag} />);

      fireEvent.press(screen.getByText('Flag this explanation'));
      fireEvent.press(screen.getByText('Too persuasive'));
      fireEvent.changeText(screen.getByPlaceholderText('Add details (optional)'), 'This nudged an opinion.');
      fireEvent.press(screen.getByText('Submit flag'));

      await waitFor(() => expect(screen.getByText('Thanks — this has been flagged.')).toBeTruthy());
      expect(onFlag).toHaveBeenCalledWith('too_persuasive', 'This nudged an opinion.');
    });

    it('submits without free text when none is entered', async () => {
      const onFlag = jest.fn().mockResolvedValue(undefined);
      render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} onFlag={onFlag} />);

      fireEvent.press(screen.getByText('Flag this explanation'));
      fireEvent.press(screen.getByText('Wrong'));
      fireEvent.press(screen.getByText('Submit flag'));

      await waitFor(() => expect(onFlag).toHaveBeenCalledWith('wrong', undefined));
    });
  });

  describe('"show your work" transparency section', () => {
    it('names the bucket values that shaped the relevance layer', () => {
      render(
        <IlluminateModal
          visible
          title="A headline"
          explanation={explanation}
          bucket={{ age: '25-34', stance: 'progressive', region: 'unspecified', gender: 'unspecified' }}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Shown because: age 25-34, progressive-leaning.')).toBeTruthy();
    });

    it('explains a fully unspecified bucket as a general explanation', () => {
      render(
        <IlluminateModal
          visible
          title="A headline"
          explanation={explanation}
          bucket={{ age: 'unspecified', stance: 'unspecified', region: 'unspecified', gender: 'unspecified' }}
          onClose={jest.fn()}
        />
      );

      expect(
        screen.getByText('Shown because: no preferences are set, so this is a general, audience-agnostic explanation.')
      ).toBeTruthy();
    });

    it('names gender alongside the other bucket values when set', () => {
      render(
        <IlluminateModal
          visible
          title="A headline"
          explanation={explanation}
          bucket={{ age: 'unspecified', stance: 'unspecified', region: 'unspecified', gender: 'woman' }}
          onClose={jest.fn()}
        />
      );

      expect(screen.getByText('Shown because: woman.')).toBeTruthy();
    });

    it('always shows the data-sent disclosure, regardless of bucket', () => {
      render(<IlluminateModal visible title="A headline" explanation={explanation} onClose={jest.fn()} />);

      expect(screen.getByText(/We send Claude this headline/)).toBeTruthy();
    });
  });
});
