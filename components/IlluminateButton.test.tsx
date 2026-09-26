import { fireEvent, render, screen } from '@testing-library/react-native';

import { IlluminateButton } from './IlluminateButton';

describe('IlluminateButton', () => {
  it('renders the default label and calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<IlluminateButton onPress={onPress} />);

    expect(screen.getByText('💡 Illuminate')).toBeTruthy();
    fireEvent.press(screen.getByTestId('illuminate-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('swaps to a sparkle on hover in, and back on hover out', () => {
    render(<IlluminateButton onPress={jest.fn()} />);
    const button = screen.getByTestId('illuminate-button');

    fireEvent(button, 'hoverIn');
    expect(screen.getByText('✨ Illuminate')).toBeTruthy();
    expect(screen.queryByText('💡 Illuminate')).toBeNull();

    fireEvent(button, 'hoverOut');
    expect(screen.getByText('💡 Illuminate')).toBeTruthy();
    expect(screen.queryByText('✨ Illuminate')).toBeNull();
  });
});
