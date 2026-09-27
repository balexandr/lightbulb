import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { ArticleImage } from './ArticleImage';

function layoutWith(width: number) {
  const container = screen.getByTestId('article-image-container');
  fireEvent(container, 'layout', { nativeEvent: { layout: { width, height: 0, x: 0, y: 0 } } });
}

function loadWith(width: number, height: number) {
  const image = screen.UNSAFE_getByType(Image);
  fireEvent(image, 'load', { source: { url: 'https://example.com/a.jpg', width, height } });
}

function containerHeight() {
  const container = screen.getByTestId('article-image-container');
  const flatStyle = [container.props.style].flat();
  const heightEntry = flatStyle.find((s: any) => s && typeof s.height === 'number');
  return heightEntry?.height;
}

describe('ArticleImage', () => {
  it('always uses contentFit="contain" - never crops', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    expect(screen.UNSAFE_getByType(Image).props.contentFit).toBe('contain');

    layoutWith(350);
    loadWith(700, 450);
    expect(screen.UNSAFE_getByType(Image).props.contentFit).toBe('contain');
  });

  it('sizes the container to the image\'s own aspect ratio once both width and natural size are known', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    layoutWith(350);
    loadWith(700, 450); // 1.556:1 -> 350 / 1.556 = 225

    expect(containerHeight()).toBeCloseTo(225, 0);
  });

  it('clamps an extremely tall (portrait) image instead of blowing up the card', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    layoutWith(350);
    loadWith(300, 1200); // very tall - naive aspect height would be 1400

    expect(containerHeight()).toBe(320);
  });

  it('clamps an extremely wide (panorama) image instead of shrinking to a sliver', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    layoutWith(350);
    loadWith(1600, 300); // very wide - naive aspect height would be ~66

    expect(containerHeight()).toBe(140);
  });

  it('gives a small fallback logo/favicon a modest fixed size instead of stretching it', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    layoutWith(350);
    loadWith(64, 64); // a small favicon-style fallback image

    expect(containerHeight()).toBe(120);
  });
});
