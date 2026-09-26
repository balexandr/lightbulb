import { Image, ImageContentFit, ImageContentPosition } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface ArticleImageProps {
  uri: string;
}

const CONTAINER_HEIGHT = 200;

// Below this width:height ratio, an image reads as portrait/headshot-
// shaped (near-square or narrower) rather than a wide banner/landscape
// photo. Cropping a lot of height off a banner-shaped image is safe from
// the top - mastheads, headline graphics, and wire-photo captions tend to
// live near the top edge. Cropping the same amount off a portrait-shaped
// photo risks slicing through a face that isn't right at the top of the
// frame (confirmed case: a headshot-style photo cut off at the subject's
// mouth). No face detection here, just this proxy - center anchoring is
// the safer default once an image is this much taller relative to its
// width.
const PORTRAIT_ASPECT_THRESHOLD = 1.2;

// expo-image's `cover` fit scales an image up to fill the box when it's
// smaller than the container - fine for a real editorial photo, but some
// sources fall back to a small favicon/logo image when no real article
// image was found (see newsService.ts's resolveArticleImages), and
// upscaling one of those to fill a 200px-tall card looks visibly blurry.
// The real pixel dimensions aren't known until the image actually loads,
// so this starts as "cover"+"top" (the common case - most images are
// large, wide editorial photos) and adjusts once the real size is known.
export function ArticleImage({ uri }: ArticleImageProps) {
  const [contentFit, setContentFit] = useState<ImageContentFit>('cover');
  const [contentPosition, setContentPosition] = useState<ImageContentPosition>('top');

  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit={contentFit}
        contentPosition={contentPosition}
        onLoad={event => {
          const { width, height } = event.source;
          if (height < CONTAINER_HEIGHT) {
            setContentFit('contain');
            return;
          }
          if (width / height < PORTRAIT_ASPECT_THRESHOLD) {
            setContentPosition('center');
          }
        }}
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
    height: CONTAINER_HEIGHT,
  },
});
