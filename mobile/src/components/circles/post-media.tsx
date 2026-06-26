// PostMedia — renders a single post/story media URL as an Image or a video
// (expo-video). Wraps the path with resolveMediaUrl(). Used by the feed card,
// the post grid lightbox, and the story viewer.
//
// Uses expo-image (disk cache + recyclingKey) instead of the RN core Image for
// all still images so that previously loaded frames are reused from the
// memory-disk cache even when cells are recycled.

import { View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { resolveMediaUrl } from '@/lib/env';
import { isVideoUrl } from './helpers';
import type { MediaVariants } from './types';

/** Which size variant to request from the image pipeline. */
export type MediaSize = 'thumb' | 'medium' | 'full';

interface PostMediaProps {
  url: string;
  /** Per-URL variant map (§1.1 pipeline). Falls back to `url` when absent. */
  variants?: MediaVariants;
  /** Which pipeline variant to prefer (ignored for videos). Default: 'full'. */
  size?: MediaSize;
  /** Fit the media inside (contain) vs fill (cover). */
  resizeMode?: 'contain' | 'cover';
  /** Show native video controls (lightbox / story). */
  controls?: boolean;
  /** Autoplay + loop muted (grid / feed previews). */
  autoplay?: boolean;
  /** Fired when an image finishes loading (videos ignore this). */
  onLoad?: () => void;
}

/**
 * Pick the best variant URL from a variants map.
 * Falls back to the base url so old posts (no variants) still render.
 */
export function pickVariantUrl(
  url: string,
  variants: MediaVariants | undefined,
  size: MediaSize,
): string {
  if (!variants) return url;
  if (size === 'thumb') return variants.thumb ?? variants.original ?? url;
  if (size === 'medium') return variants.medium ?? variants.original ?? url;
  // 'full' — prefer original, fall back to the raw url
  return variants.original ?? url;
}

export function PostMedia({
  url,
  variants,
  size = 'full',
  resizeMode = 'cover',
  controls = false,
  autoplay = false,
  onLoad,
}: PostMediaProps) {
  const resolved = resolveMediaUrl(url) ?? url;
  const video = isVideoUrl(url);

  if (video) {
    return (
      <PostVideo
        uri={resolved}
        controls={controls}
        autoplay={autoplay}
        contentFit={resizeMode === 'contain' ? 'contain' : 'cover'}
      />
    );
  }

  const variantUrl = pickVariantUrl(resolved, variants, size);

  return (
    <Image
      source={{ uri: variantUrl }}
      contentFit={resizeMode}
      cachePolicy="memory-disk"
      recyclingKey={variantUrl}
      onLoad={onLoad}
      onError={onLoad}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function PostVideo({
  uri,
  controls,
  autoplay,
  contentFit,
}: {
  uri: string;
  controls: boolean;
  autoplay: boolean;
  contentFit: 'contain' | 'cover';
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = !controls;
    p.loop = autoplay;
    if (autoplay) p.play();
  });

  return (
    <View style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
      <VideoView
        player={player}
        nativeControls={controls}
        contentFit={contentFit}
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
