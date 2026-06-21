// PostMedia — renders a single post/story media URL as an Image or a video
// (expo-video). Wraps the path with resolveMediaUrl(). Used by the feed card,
// the post grid lightbox, and the story viewer.

import { Image, View, type ImageResizeMode } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { resolveMediaUrl } from '@/lib/env';
import { isVideoUrl } from './helpers';

interface PostMediaProps {
  url: string;
  /** Fit the media inside (contain) vs fill (cover). */
  resizeMode?: ImageResizeMode;
  /** Show native video controls (lightbox / story). */
  controls?: boolean;
  /** Autoplay + loop muted (grid / feed previews). */
  autoplay?: boolean;
  /** Fired when an image finishes loading (videos ignore this). */
  onLoad?: () => void;
}

export function PostMedia({
  url,
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

  return (
    <Image
      source={{ uri: resolved }}
      resizeMode={resizeMode}
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
