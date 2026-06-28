import { useEffect } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Heart, Trash2, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/env';
import { useMediaStore, type MediaItem } from '@/stores/media-store';

function LightboxVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  const { width, height } = useWindowDimensions();
  return (
    <VideoView
      player={player}
      style={{ width, height: height * 0.7 }}
      contentFit="contain"
      nativeControls
    />
  );
}

export function MediaLightbox({ readOnly }: { readOnly?: boolean } = {}) {
  const lightboxIndex = useMediaStore((s) => s.lightboxIndex);
  const items = useMediaStore((s) => s.items);
  const closeLightbox = useMediaStore((s) => s.closeLightbox);
  const lightboxNext = useMediaStore((s) => s.lightboxNext);
  const lightboxPrev = useMediaStore((s) => s.lightboxPrev);
  const toggleFavorite = useMediaStore((s) => s.toggleFavorite);
  const deleteMedia = useMediaStore((s) => s.deleteMedia);

  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const isOpen = lightboxIndex !== null;
  const currentItem: MediaItem | undefined =
    lightboxIndex !== null ? items[lightboxIndex] : undefined;

  const translateX = useSharedValue(0);

  useEffect(() => {
    translateX.value = 0;
  }, [lightboxIndex, translateX]);

  if (!isOpen || !currentItem) return null;

  const isVideo = currentItem.type === 'video';
  const imageUrl = resolveMediaUrl(currentItem.cdnUrl ?? undefined);
  const isFavorite = !!currentItem.isFavorite;

  const handleDelete = () => {
    const id = currentItem.id;
    const atEnd = lightboxIndex !== null && lightboxIndex >= items.length - 1;
    deleteMedia(id);
    if (items.length <= 1) {
      closeLightbox();
    } else if (atEnd) {
      lightboxPrev();
    }
  };

  // Horizontal swipe to navigate between items.
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX < -60) {
        translateX.value = withTiming(-width, { duration: 120 }, () => {
          runOnJS(lightboxNext)();
        });
      } else if (e.translationX > 60) {
        translateX.value = withTiming(width, { duration: 120 }, () => {
          runOnJS(lightboxPrev)();
        });
      } else {
        translateX.value = withTiming(0, { duration: 150 });
      }
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeLightbox} statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* Tap backdrop to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeLightbox} />

        {/* Top bar */}
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.topLeft}>
            <AppText color="rgba(255,255,255,0.85)" variant="caption">
              {(lightboxIndex ?? 0) + 1} / {items.length}
            </AppText>
            <AppText color="rgba(255,255,255,0.6)" variant="caption" numberOfLines={1} style={{ maxWidth: 180 }}>
              {currentItem.originalFilename}
            </AppText>
          </View>
          <View style={styles.topActions}>
            {readOnly ? null : (
              <>
                <Pressable onPress={() => toggleFavorite(currentItem.id)} hitSlop={8} style={styles.iconBtn}>
                  <Heart
                    color={isFavorite ? colors.primary : 'rgba(255,255,255,0.8)'}
                    size={22}
                    fill={isFavorite ? colors.primary : 'none'}
                  />
                </Pressable>
                <Pressable onPress={handleDelete} hitSlop={8} style={styles.iconBtn}>
                  <Trash2 color="rgba(255,255,255,0.8)" size={22} />
                </Pressable>
              </>
            )}
            <Pressable onPress={closeLightbox} hitSlop={8} style={styles.iconBtn}>
              <X color="rgba(255,255,255,0.9)" size={24} />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <GestureDetector gesture={swipe}>
          <Animated.View style={[styles.content, animStyle]}>
            {isVideo && imageUrl ? (
              <LightboxVideo uri={imageUrl} />
            ) : imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="contain"
                transition={150}
              />
            ) : (
              <Heart color="rgba(255,255,255,0.3)" size={48} />
            )}
          </Animated.View>
        </GestureDetector>

        {/* Nav arrows */}
        {items.length > 1 ? (
          <>
            <Pressable onPress={lightboxPrev} style={[styles.navBtn, { left: 12 }]} hitSlop={8}>
              <ChevronLeft color="rgba(255,255,255,0.85)" size={26} />
            </Pressable>
            <Pressable onPress={lightboxNext} style={[styles.navBtn, { right: 12 }]} hitSlop={8}>
              <ChevronRight color="rgba(255,255,255,0.85)" size={26} />
            </Pressable>
          </>
        ) : null}

        {/* Caption */}
        {currentItem.caption ? (
          <View style={styles.caption} pointerEvents="none">
            <AppText color="rgba(255,255,255,0.9)" variant="caption" center>
              {currentItem.caption}
            </AppText>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const WIN = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  topLeft: { flex: 1, gap: 2 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: {
    width: WIN.width,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: WIN.width, height: WIN.height * 0.7 },
  navBtn: {
    position: 'absolute',
    top: '50%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  caption: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
});
