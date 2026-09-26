import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { ArticleImage } from './ArticleImage';

function loadWith(width: number, height: number) {
  const image = screen.UNSAFE_getByType(Image);
  fireEvent(image, 'load', { source: { url: 'https://example.com/a.jpg', width, height } });
}

describe('ArticleImage', () => {
  it('starts as "cover"/"top" before the image has loaded (the common case is a large, wide photo)', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.contentPosition).toBe('top');
  });

  it('stays "cover"/"top" once a large, wide (landscape) image loads', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(700, 450); // 1.56:1 - a typical wide editorial photo

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.contentPosition).toBe('top');
  });

  it('switches to "contain" once a shorter-than-container image loads, to avoid upscaling it blurry', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(64, 64); // a small favicon-style fallback image

    expect(screen.UNSAFE_getByType(Image).props.contentFit).toBe('contain');
  });

  it('switches to "center" cropping for a tall, large enough, portrait/headshot-shaped photo', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(400, 450); // 0.89:1 - near-square, portrait-shaped, but well over the container's height

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.contentPosition).toBe('center');
  });
});
