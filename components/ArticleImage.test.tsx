import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { ArticleImage } from './ArticleImage';

function loadWith(height: number, width: number = 400) {
  const image = screen.UNSAFE_getByType(Image);
  fireEvent(image, 'load', { source: { url: 'https://example.com/a.jpg', width, height } });
}

describe('ArticleImage', () => {
  it('starts as "cover" before the image has loaded (the common case is a large enough photo)', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    expect(screen.UNSAFE_getByType(Image).props.contentFit).toBe('cover');
  });

  it('stays "cover" once a large-enough image loads, cropped from the top', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(450);

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.contentPosition).toBe('top');
  });

  it('switches to "contain" once a shorter-than-container image loads, to avoid upscaling it blurry', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(64, 64); // a small favicon-style fallback image

    expect(screen.UNSAFE_getByType(Image).props.contentFit).toBe('contain');
  });
});
