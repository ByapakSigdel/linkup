import { useMemo } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Heart, Play, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/env';
import { useMediaStore, type MediaItem } from '@/stores/media-store';

const GAP = 6;
const SCREEN_PADDING = 16;

interface MediaGridProps {
  items: MediaItem[];
  numColumns?: number;
  onItemPress?: (item: MediaItem, index: number) => void;
}

/**
 * Computes a fixed cell size from the screen width so the FlatList grid stays
 * square regardless of column count.
 */
export function useGridCellSize(numColumns: number) {
  const { width } = useWindowDimensions();
  const available = width - SCREEN_PADDING * 2 - GAP * (numColumns - 1);
  return Math.floor(available / numColumns);
}

interface MediaGridItemProps {
  item: MediaItem;
  size: number;
  onPress?: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
}

export function MediaGridItem({
  item,
  size,
  onPress,
  onToggleFavorite,
  onDelete,
}: MediaGridItemProps) {
  const { colors, radius } = useTheme();
  const isVideo = item.type === 'video';
  const isFavorite = !!item.isFavorite;
  const imageUrl = resolveMediaUrl(
    item.cdnUrl ?? item.thumbnails?.medium ?? item.thumbnails?.small ?? undefined,
  );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.card,
          overflow: 'hidden',
          backgroundColor: colors.surfaceActive,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.center}>
          <Heart color={colors.textMuted} size={28} />
        </View>
      )}

      {isVideo ? (
        <View style={styles.center} pointerEvents="none">
          <View style={styles.playBadge}>
            <Play color="#fff" size={20} fill="#fff" />
          </View>
        </View>
      ) : null}

      {isVideo && item.duration ? (
        <View style={styles.duration} pointerEvents="none">
          <AppText variant="caption" color="#fff" style={{ fontSize: 10 }}>
            {Math.floor(item.duration / 60)}:
            {(item.duration % 60).toString().padStart(2, '0')}
          </AppText>
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={6}
          style={[
            styles.actionBtn,
            { backgroundColor: isFavorite ? colors.primary : 'rgba(0,0,0,0.45)' },
          ]}
        >
          <Heart color="#fff" size={14} fill={isFavorite ? '#fff' : 'none'} />
        </Pressable>
        <Pressable
          onPress={onDelete}
          hitSlop={6}
          style={[styles.actionBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        >
          <Trash2 color="#fff" size={14} />
        </Pressable>
      </View>
    </Pressable>
  );
}

/**
 * Standalone grid used outside a FlatList context (wraps in a flex row).
 */
export function MediaGrid({ items, numColumns = 3, onItemPress }: MediaGridProps) {
  const { colors } = useTheme();
  const size = useGridCellSize(numColumns);
  const toggleFavorite = useMediaStore((s) => s.toggleFavorite);
  const deleteMedia = useMediaStore((s) => s.deleteMedia);

  const rows = useMemo(() => items, [items]);

  if (rows.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceActive }]}>
          <Heart color={colors.textMuted} size={26} />
        </View>
        <AppText variant="subtitle" center>No photos yet</AppText>
        <AppText muted center variant="caption">
          Upload your first photo to start building your gallery
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.flexGrid}>
      {rows.map((item, index) => (
        <Animated.View key={item.id} entering={FadeIn.delay(Math.min(index, 12) * 30)}>
          <MediaGridItem
            item={item}
            size={size}
            onPress={() => onItemPress?.(item, index)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            onDelete={() => deleteMedia(item.id)}
          />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  actions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    gap: 6,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
});

export { GAP as MEDIA_GRID_GAP };
