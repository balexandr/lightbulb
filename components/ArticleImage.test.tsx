import { fireEvent, render, screen } from '@testing-library/react-native';
import { Image } from 'expo-image';

import { ArticleImage } from './ArticleImage';

function loadWith(width: number, height: number) {
  const image = screen.UNSAFE_getByType(Image);
  fireEvent(image, 'load', { source: { url: 'https://example.com/a.jpg', width, height } });
}

describe('ArticleImage', () => {
  it('starts as "cover"/"center" before the image has loaded (the common case is a large enough photo)', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.contentPosition).toBe('center');
  });

  it('stays "cover"/"center" once a large enough image loads, regardless of its aspect ratio', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(700, 450); // wide/landscape

    const wide = screen.UNSAFE_getByType(Image);
    expect(wide.props.contentFit).toBe('cover');
    expect(wide.props.contentPosition).toBe('center');
  });

  it('switches to "contain" once a shorter-than-container image loads, to avoid upscaling it blurry', () => {
    render(<ArticleImage uri="https://example.com/a.jpg" />);
    loadWith(64, 64); // a small favicon-style fallback image

    expect(screen.UNSAFE_getByType(Image).props.contentFit).toBe('contain');
  });
});
