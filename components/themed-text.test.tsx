import { render, screen } from '@testing-library/react-native';

import { ThemedText } from './themed-text';

describe('ThemedText', () => {
  it('renders its children', () => {
    render(<ThemedText>Hello world</ThemedText>);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('applies the title style variant', () => {
    render(<ThemedText type="title">Big title</ThemedText>);
    const node = screen.getByText('Big title');
    const flatStyle = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(flatStyle.fontSize).toBe(32);
  });

  it('prefers an explicit lightColor over the theme default', () => {
    render(<ThemedText lightColor="#ff0000">Colored</ThemedText>);
    const node = screen.getByText('Colored');
    const flatStyle = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
    expect(flatStyle.color).toBe('#ff0000');
  });
});
