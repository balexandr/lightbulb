import { Image } from 'expo-image';
import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';

interface ArticleImageProps {
  uri: string;
}

// Before the real image size is known (first render, or still loading),
// use this as a reasonable placeholder height.
const DEFAULT_HEIGHT = 200;

// Real photos get shown at their own aspect ratio, clamped to this range
// so a pathological aspect ratio (a tall infographic, a wide panorama)
// can't make a feed card absurdly tall or a sliver thin. Clamping never
// crops - see contentFit="contain" below.
const MIN_HEIGHT = 140;
const MAX_HEIGHT = 320;

// Below this native pixel height, treat an image as a small fallback
// logo/favicon (see newsService.ts's resolveArticleImages - used when no
// real article image was found) rather than a real photo, and give it a
// modest fixed display size instead of stretching it up to fill a
// photo-sized box, which would look visibly blurry.
const SMALL_IMAGE_THRESHOLD = 150;
const SMALL_IMAGE_HEIGHT = 120;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// This component exists because fixed-crop cropping (contentFit="cover"
// anchored to a fixed edge) kept cutting people out of real news photos,
// confirmed on three separate real articles: anchoring to the top cut a
// headshot off at the subject's chin; anchoring to the center cut a
// group photo's heads off entirely, keeping only their bodies. There is
// no single fixed anchor point that works for every photo composition
// without actually knowing where the subject is in the frame, and this
// app has no face/subject detection to find out.
//
// So it doesn't crop at all: once both the card's rendered width (from
// onLayout) and the image's real natural size (from onLoad) are known,
// the container is sized to show the image at its own aspect ratio in
// full, via contentFit="contain" - the only crop-free fit mode. Small
// fallback images get their own modest fixed size instead, to avoid
// blurry upscaling.
export function ArticleImage({ uri }: ArticleImageProps) {
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  let height = DEFAULT_HEIGHT;
  if (naturalSize) {
    if (naturalSize.height < SMALL_IMAGE_THRESHOLD) {
      height = SMALL_IMAGE_HEIGHT;
    } else if (containerWidth) {
      const naturalAspectHeight = containerWidth * (naturalSize.height / naturalSize.width);
      height = clamp(naturalAspectHeight, MIN_HEIGHT, MAX_HEIGHT);
    }
  }

  return (
    <View
      testID="article-image-container"
      style={[styles.container, { height }]}
      onLayout={(event: LayoutChangeEvent) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit="contain"
        onLoad={event => setNaturalSize(event.source)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
