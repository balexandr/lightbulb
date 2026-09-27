import { Image, ImageContentFit } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface ArticleImageProps {
  uri: string;
}

const CONTAINER_HEIGHT = 200;

// expo-image's `cover` fit scales an image up to fill the box when it's
// smaller than the container - fine for a real editorial photo, but some
// sources fall back to a small favicon/logo image when no real article
// image was found (see newsService.ts's resolveArticleImages), and
// upscaling one of those to fill a 200px-tall card looks visibly blurry.
// The real pixel dimensions aren't known until the image actually loads,
// so this starts as "cover" (the common case - most images are large
// enough) and switches to "contain" (shrink to fit, no crop, no
// upscaling) only if the loaded image turns out shorter than the
// container.
//
// contentPosition is always "center", not "top" - a top-anchor crop was
// tried and reverted (docs: two real photos had the subject's head cut
// off, since a face isn't reliably positioned at the very top of a news
// photo, and there's no face detection here to do better). Center is the
// standard safe default for photos of people; it costs the top edge of
// very tall banner/graphic-style images, which is an accepted tradeoff
// over cutting off people's heads.
export function ArticleImage({ uri }: ArticleImageProps) {
  const [contentFit, setContentFit] = useState<ImageContentFit>('cover');

  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        contentFit={contentFit}
        contentPosition="center"
        onLoad={event => {
          if (event.source.height < CONTAINER_HEIGHT) {
            setContentFit('contain');
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
