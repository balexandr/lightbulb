import { Text } from 'react-native';

import { render, screen } from '@testing-library/react-native';

import { ThemedView } from './themed-view';

describe('ThemedView', () => {
  it('renders its children', () => {
    render(
      <ThemedView>
        <Text>inside</Text>
      </ThemedView>
    );
    expect(screen.getByText('inside')).toBeTruthy();
  });

  it('accepts an explicit darkColor without throwing', () => {
    render(<ThemedView darkColor="#000000" testID="themed-view" />);
    const node = screen.getByTestId('themed-view');
    const flatStyle = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    // Native test env defaults to light scheme, so darkColor shouldn't apply,
    // but the prop should still be accepted without throwing and the light
    // background should be used instead.
    expect(flatStyle.backgroundColor).toBeDefined();
  });

  it('merges custom style with the background color', () => {
    render(<ThemedView testID="themed-view" style={{ padding: 10 }} />);
    const node = screen.getByTestId('themed-view');
    const flatStyle = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(flatStyle.padding).toBe(10);
    expect(flatStyle.backgroundColor).toBeDefined();
  });
});
