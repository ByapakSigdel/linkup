import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  Flame,
  Folder,
  Heart,
  Image as ImageIcon,
  Plus,
  X,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  Row,
  Screen,
  Skeleton,
  Spinner,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import {
  AlbumCard,
  MediaGridItem,
  MediaLightbox,
  UploadControl,
  useGridCellSize,
  MEDIA_GRID_GAP,
} from '@/components/media';
import { useAuthStore, isActivelyPaired } from '@/stores/auth-store';
import { useMediaStore } from '@/stores/media-store';
import { useResponsive } from '@/hooks/use-responsive';

export default function GalleryScreen({ readOnly: readOnlyProp }: { readOnly?: boolean } = {}) {
  const { colors, radius } = useTheme();
  const { gridColumns, isTablet } = useResponsive();
  // Photo grid: 3 on phones → up to 5 on wide screens.
  const GRID_COLUMNS = gridColumns;
  // Albums: 2 on phones → up to 4 on wide tablets.
  const ALBUM_COLUMNS = isTablet ? Math.max(2, gridColumns - 1) : 2;
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const coupleId = couple?.id;
  // Read-only memorial mode: shared photos are browsable but frozen — no upload,
  // favorite, delete or album creation. Defaults to the store-derived gate.
  const readOnly = readOnlyProp ?? !isActivelyPaired({ user, couple });

  const {
    items,
    total,
    isLoading,
    hasMore,
    albums,
    isLoadingAlbums,
    activeTab,
    streakFilter,
    favoriteFilter,
    albumFilter,
    setActiveTab,
    setStreakFilter,
    setFavoriteFilter,
    setAlbumFilter,
    fetchMedia,
    fetchAlbums,
    openLightbox,
    toggleFavorite,
    deleteMedia,
    createAlbum,
  } = useMediaStore();

  const [showUpload, setShowUpload] = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');

  const cellSize = useGridCellSize(GRID_COLUMNS);
  const { width: winWidth } = useWindowDimensions();
  const albumGap = MEDIA_GRID_GAP * 2;
  const albumWidth = Math.floor((winWidth - 16 * 2 - albumGap * (ALBUM_COLUMNS - 1)) / ALBUM_COLUMNS);

  // Initial fetch
  useEffect(() => {
    if (!coupleId) return;
    fetchMedia(coupleId);
    fetchAlbums(coupleId);
  }, [coupleId, fetchMedia, fetchAlbums]);

  // Refetch when filters change
  useEffect(() => {
    if (!coupleId) return;
    fetchMedia(coupleId);
  }, [coupleId, streakFilter, favoriteFilter, albumFilter, fetchMedia]);

  const handleLoadMore = useCallback(() => {
    if (!coupleId || isLoading || !hasMore) return;
    fetchMedia(coupleId, items.length);
  }, [coupleId, isLoading, hasMore, items.length, fetchMedia]);

  const handleAlbumPress = useCallback(
    (albumId: string) => {
      setAlbumFilter(albumFilter === albumId ? null : albumId);
      setActiveTab('all');
    },
    [albumFilter, setAlbumFilter, setActiveTab],
  );

  const handleCreateAlbum = useCallback(async () => {
    if (readOnly || !coupleId || !newAlbumName.trim()) return;
    await createAlbum(coupleId, {
      name: newAlbumName.trim(),
      description: newAlbumDesc.trim() || undefined,
    });
    setNewAlbumName('');
    setNewAlbumDesc('');
    setShowNewAlbum(false);
  }, [readOnly, coupleId, newAlbumName, newAlbumDesc, createAlbum]);

  // ── Not paired ─────────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <Screen padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ScreenHeader title="Gallery" />
        </View>
        <EmptyState
          icon={<ImageIcon color={colors.textMuted} size={40} />}
          title="No gallery yet"
          subtitle="Link up with your partner to start sharing photos and creating memories together."
        />
      </Screen>
    );
  }

  const showingPhotos = activeTab === 'all' || !!albumFilter;

  const activeAlbumName = albums.find((a) => a.id === albumFilter)?.name ?? 'Album';

  // ── Header block (rendered above the grid / list) ───────────────────────────
  const Tabs = (
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => {
          setActiveTab('all');
          setAlbumFilter(null);
        }}
        style={[
          styles.tab,
          { borderBottomColor: activeTab === 'all' && !albumFilter ? colors.primary : 'transparent' },
        ]}
      >
        <ImageIcon
          color={activeTab === 'all' && !albumFilter ? colors.primary : colors.textMuted}
          size={16}
        />
        <AppText
          variant="label"
          color={activeTab === 'all' && !albumFilter ? colors.primary : colors.textMuted}
        >
          All Photos ({total})
        </AppText>
      </Pressable>
      <Pressable
        onPress={() => setActiveTab('albums')}
        style={[
          styles.tab,
          { borderBottomColor: activeTab === 'albums' ? colors.primary : 'transparent' },
        ]}
      >
        <Folder color={activeTab === 'albums' ? colors.primary : colors.textMuted} size={16} />
        <AppText variant="label" color={activeTab === 'albums' ? colors.primary : colors.textMuted}>
          Albums ({albums.length})
        </AppText>
      </Pressable>
    </View>
  );

  const FilterChips = (
    <View style={styles.chipRow}>
      {albumFilter ? (
        <Pressable
          onPress={() => setAlbumFilter(null)}
          style={[styles.chip, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
        >
          <Folder color={colors.primary} size={12} />
          <AppText variant="caption" color={colors.primary} weight="600">{activeAlbumName}</AppText>
          <X color={colors.primary} size={12} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => setStreakFilter(!streakFilter)}
        style={[
          styles.chip,
          {
            backgroundColor: streakFilter ? colors.primaryLight : colors.surface,
            borderColor: streakFilter ? colors.primary : colors.border,
          },
        ]}
      >
        <Flame color={streakFilter ? colors.primary : colors.textMuted} size={12} />
        <AppText variant="caption" color={streakFilter ? colors.primary : colors.textMuted} weight="600">
          Streak Photos
        </AppText>
      </Pressable>
      <Pressable
        onPress={() => setFavoriteFilter(!favoriteFilter)}
        style={[
          styles.chip,
          {
            backgroundColor: favoriteFilter ? colors.primaryLight : colors.surface,
            borderColor: favoriteFilter ? colors.primary : colors.border,
          },
        ]}
      >
        <Heart color={favoriteFilter ? colors.primary : colors.textMuted} size={12} />
        <AppText variant="caption" color={favoriteFilter ? colors.primary : colors.textMuted} weight="600">
          Favorites
        </AppText>
      </Pressable>
    </View>
  );

  const Header = (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      <View style={styles.headerRow}>
        <View>
          <AppText variant="caption" muted style={styles.eyebrow}>SHARED MEMORIES</AppText>
          <AppText muted variant="caption">
            {total} photo{total !== 1 ? 's' : ''} · {albums.length} album{albums.length !== 1 ? 's' : ''}
          </AppText>
        </View>
        {readOnly ? null : (
          <Button
            variant="outline"
            size="sm"
            onPress={() => setShowUpload((v) => !v)}
            leftIcon={<Plus color={colors.text} size={16} />}
            label="Upload"
          />
        )}
      </View>

      {!readOnly && showUpload && coupleId ? (
        <Animated.View entering={FadeIn}>
          <Card>
            <UploadControl coupleId={coupleId} albumId={albumFilter ?? undefined} />
          </Card>
        </Animated.View>
      ) : null}

      {Tabs}

      {activeTab === 'all' ? FilterChips : null}
    </View>
  );

  // ── Photos grid view ────────────────────────────────────────────────────────
  if (showingPhotos) {
    const loadingFirst = isLoading && items.length === 0;

    return (
      <Screen padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ScreenHeader title="Gallery" onBack={() => router.back()} />
        </View>
        {loadingFirst ? (
          <View style={styles.body}>
            {Header}
            <View style={styles.skeletonGrid}>
              {Array.from({ length: GRID_COLUMNS * 3 }).map((_, i) => (
                <Skeleton key={i} width={cellSize} height={cellSize} radius={radius.card} />
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={items}
            key={`grid-${GRID_COLUMNS}`}
            numColumns={GRID_COLUMNS}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={Header}
            columnWrapperStyle={{ gap: MEDIA_GRID_GAP }}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: MEDIA_GRID_GAP }} />}
            renderItem={({ item, index }) => (
              <MediaGridItem
                item={item}
                size={cellSize}
                readOnly={readOnly}
                onPress={() => openLightbox(index)}
                onToggleFavorite={readOnly ? undefined : () => toggleFavorite(item.id)}
                onDelete={readOnly ? undefined : () => deleteMedia(item.id)}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={<Heart color={colors.textMuted} size={40} />}
                title="No photos yet"
                subtitle="Upload your first photo to start building your gallery"
              />
            }
            ListFooterComponent={
              hasMore && items.length > 0 ? (
                <View style={{ paddingTop: 16, alignItems: 'center' }}>
                  <Button variant="outline" size="sm" onPress={handleLoadMore} loading={isLoading} label="Load more" />
                </View>
              ) : null
            }
            onEndReachedThreshold={0.4}
            onEndReached={handleLoadMore}
            showsVerticalScrollIndicator={false}
          />
        )}
        <MediaLightbox readOnly={readOnly} />
      </Screen>
    );
  }

  // ── Albums view ─────────────────────────────────────────────────────────────
  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="Gallery" onBack={() => router.back()} />
      </View>
      <FlatList
        data={albums}
        key={`albums-${ALBUM_COLUMNS}`}
        numColumns={ALBUM_COLUMNS}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={{ gap: MEDIA_GRID_GAP * 2 }}
        ItemSeparatorComponent={() => <View style={{ height: MEDIA_GRID_GAP * 2 }} />}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 14 }}>
            {Header}
            <View style={styles.headerRow}>
              <AppText muted variant="caption">
                {albums.length} album{albums.length !== 1 ? 's' : ''}
              </AppText>
              {readOnly ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setShowNewAlbum((v) => !v)}
                  leftIcon={<Plus color={colors.text} size={16} />}
                  label="New Album"
                />
              )}
            </View>
            {!readOnly && showNewAlbum ? (
              <Animated.View entering={FadeIn}>
                <Card>
                  <View style={{ gap: 10 }}>
                    <Input
                      placeholder="Album name"
                      value={newAlbumName}
                      onChangeText={setNewAlbumName}
                      autoFocus
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newAlbumDesc}
                      onChangeText={setNewAlbumDesc}
                    />
                    <Row>
                      <Button
                        size="sm"
                        onPress={handleCreateAlbum}
                        disabled={!newAlbumName.trim()}
                        label="Create"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          setShowNewAlbum(false);
                          setNewAlbumName('');
                          setNewAlbumDesc('');
                        }}
                        label="Cancel"
                      />
                    </Row>
                  </View>
                </Card>
              </Animated.View>
            ) : null}
            {isLoadingAlbums ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Spinner />
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <AlbumCard
            album={item}
            width={albumWidth}
            active={albumFilter === item.id}
            onPress={() => handleAlbumPress(item.id)}
          />
        )}
        ListEmptyComponent={
          !isLoadingAlbums ? (
            <EmptyState
              icon={<Folder color={colors.textMuted} size={40} />}
              title="No albums yet"
              subtitle="Create your first album to organize your photos"
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
      <MediaLightbox readOnly={readOnly} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eyebrow: { letterSpacing: 1.6, fontWeight: '700', fontSize: 10, marginBottom: 2 },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MEDIA_GRID_GAP,
    paddingTop: 8,
  },
});
