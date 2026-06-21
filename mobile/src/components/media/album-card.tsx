import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Folder, Image as ImageIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/env';
import type { MediaAlbum } from '@/stores/media-store';

interface AlbumCardProps {
  album: MediaAlbum;
  width: number;
  onPress?: () => void;
  active?: boolean;
}

export function AlbumCard({ album, width, onPress, active }: AlbumCardProps) {
  const { colors, radius } = useTheme();
  const cover = resolveMediaUrl(album.coverUrl ?? undefined);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.cover, { backgroundColor: colors.surfaceActive }]}>
        {cover ? (
          <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.center}>
            <Folder color={colors.textMuted} size={36} />
          </View>
        )}
        <View style={styles.countBadge}>
          <ImageIcon color="#fff" size={12} />
          <AppText variant="caption" color="#fff" style={{ fontSize: 11 }}>
            {album.mediaCount ?? 0}
          </AppText>
        </View>
      </View>

      <View style={styles.info}>
        <AppText variant="label" numberOfLines={1}>{album.name}</AppText>
        {album.description ? (
          <AppText muted variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>
            {album.description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: { aspectRatio: 4 / 3, width: '100%' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  info: { padding: 10 },
});
