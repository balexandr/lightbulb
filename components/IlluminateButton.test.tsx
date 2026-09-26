import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { IlluminateButton } from './IlluminateButton';

describe('IlluminateButton', () => {
  it('renders a lightbulb icon and label, and calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<IlluminateButton onPress={onPress} />);

    expect(screen.getByText('Illuminate')).toBeTruthy();
    expect(screen.UNSAFE_getByProps({ name: 'lightbulb' })).toBeTruthy();
    fireEvent.press(screen.getByTestId('illuminate-button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('brightens the background on hover in, and reverts on hover out - without changing the icon', () => {
    render(<IlluminateButton onPress={jest.fn()} />);
    const button = screen.getByTestId('illuminate-button');
    const flatStyle = () => StyleSheet.flatten(button.props.style);

    expect(flatStyle().backgroundColor).toBe('rgba(255, 193, 7, 0.15)');

    fireEvent(button, 'hoverIn');
    expect(flatStyle().backgroundColor).toBe('rgba(255, 193, 7, 0.35)');
    expect(screen.UNSAFE_getByProps({ name: 'lightbulb' })).toBeTruthy();

    fireEvent(button, 'hoverOut');
    expect(flatStyle().backgroundColor).toBe('rgba(255, 193, 7, 0.15)');
    expect(screen.UNSAFE_getByProps({ name: 'lightbulb' })).toBeTruthy();
  });
});
