// PostGrid — Instagram-style virtualized thumbnail grid of a circle's posts.
// Ported from apps/web/src/components/circles/post-grid.tsx. Tapping a thumbnail
// opens a full-screen lightbox modal with carousel paging, caption, and counts.
//
// Drives the profile screen as a single virtualized FlatList (numColumns) with
// an optional ListHeaderComponent (the ProfileHeader) and onEndReached infinite
// scroll — replacing the eager ScrollView + "Load more" button (§1.4).
//
// Uses expo-image (memory-disk cache + recyclingKey) via PostMedia for cells.
// Grid cells request the 'thumb' variant (~256px); the lightbox requests 'full'.

import { type ReactElement, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
  Alert,
  type RefreshControlProps,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import {
  Heart,
  MessageCircle,
  X,
  Copy,
  ImageOff,
  Trash2,
} from 'lucide-react-native';
import { AppText, Spinner, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { PostMedia } from './post-media';
import type { CirclePost } from './types';

export interface PostGridProps {
  posts: CirclePost[];
  loading?: boolean;
  emptyLabel?: string;
  /** Column count (defaults to 3 — phone Instagram grid). Tablets pass more. */
  columns?: number;
  /** Width available for the grid (defaults to window width). Used to size cells. */
  containerWidth?: number;
  /** Owner-only: when set, the lightbox shows a delete affordance. */
  onDeletePost?: (post: CirclePost) => void | Promise<void>;
  /** Sticky-on-top content (e.g. ProfileHeader) that scrolls with the grid. */
  ListHeaderComponent?: ReactElement | null;
  /** Pull-to-refresh control forwarded to the underlying FlatList. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Infinite scroll: fired as the end approaches; load the next page here. */
  onEndReached?: () => void;
  /** Whether a next page is currently being fetched (renders a footer spinner). */
  loadingMore?: boolean;
  /** Whether more pages remain (renders an "all caught up" footer when false). */
  hasMore?: boolean;
  /** Extra bottom padding for the scroll content. */
  contentBottomInset?: number;
  /** Horizontal padding for the scroll content (defaults to 16). */
  contentHorizontalInset?: number;
  /** Center the scroll content at this width on wide (tablet) screens. */
  maxWidth?: number;
}

const GAP = 2;

export function PostGrid({
  posts,
  loading = false,
  emptyLabel = 'No posts yet',
  columns = 3,
  containerWidth,
  onDeletePost,
  ListHeaderComponent,
  refreshControl,
  onEndReached,
  loadingMore = false,
  hasMore = false,
  contentBottomInset = 24,
  contentHorizontalInset = 16,
  maxWidth,
}: PostGridProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cols = Math.max(1, columns);
  // 32 = the 16px horizontal padding on each side of the profile content column.
  const avail = (containerWidth ?? width) - 32;
  const cell = Math.floor((avail - GAP * (cols - 1)) / cols);
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openId) ?? null;

  const loadingState =
    loading && posts.length === 0 ? (
      <View style={{ alignItems: 'center', paddingVertical: 64 }}>
        <Spinner size="large" />
      </View>
    ) : (
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64, gap: 8 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: colors.surfaceActive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ImageOff size={22} color={colors.textMuted} />
        </View>
        <AppText variant="body" muted center>
          {emptyLabel}
        </AppText>
      </View>
    );

  return (
    <>
      <FlatList
        data={posts}
        key={cols}
        numColumns={cols}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={loadingState}
        columnWrapperStyle={cols > 1 ? { gap: GAP } : undefined}
        contentContainerStyle={{
          gap: GAP,
          paddingHorizontal: contentHorizontalInset,
          paddingBottom: contentBottomInset,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.6}
        renderItem={({ item: post }) => {
          const cover = post.mediaUrls[0];
          const coverVariants = post.mediaObjects?.[0];
          const isMulti = post.mediaUrls.length > 1;
          return (
            <Pressable
              onPress={() => setOpenId(post.id)}
              accessibilityRole="button"
              accessibilityLabel="Open post"
              style={{ width: cell, height: cell, backgroundColor: colors.surfaceActive, overflow: 'hidden' }}
            >
              {cover ? (
                // Use thumb (~256px) for the compact grid cell.
                <PostMedia url={cover} variants={coverVariants} size="thumb" resizeMode="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ImageOff size={22} color={colors.textMuted} />
                </View>
              )}
              {isMulti ? (
                <View style={{ position: 'absolute', top: 6, right: 6 }}>
                  <Copy size={16} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
                </View>
              ) : null}
            </Pressable>
          );
        }}
        ListFooterComponent={
          posts.length > 0 ? (
            loadingMore ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Spinner size="small" />
              </View>
            ) : !hasMore ? (
              <AppText variant="caption" muted center style={{ paddingVertical: 20 }}>
                You&apos;re all caught up.
              </AppText>
            ) : null
          ) : null
        }
      />

      <Modal visible={!!openPost} transparent animationType="fade" onRequestClose={() => setOpenId(null)}>
        {openPost ? (
          <Lightbox post={openPost} onClose={() => setOpenId(null)} onDeletePost={onDeletePost} />
        ) : null}
      </Modal>
    </>
  );
}

function Lightbox({
  post,
  onClose,
  onDeletePost,
}: {
  post: CirclePost;
  onClose: () => void;
  onDeletePost?: (post: CirclePost) => void | Promise<void>;
}) {
  const { colors, radius } = useTheme();
  const { width } = useWindowDimensions();
  const stage = Math.min(width, 480);
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const count = post.mediaUrls.length;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / stage);
    if (i !== index) setIndex(i);
  };

  const confirmDelete = () => {
    if (!onDeletePost || deleting) return;
    Alert.alert(
      'Delete post?',
      'This will permanently remove this post from your circle. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await onDeletePost(post);
              onClose();
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{
          position: 'absolute',
          top: 48,
          right: 20,
          zIndex: 10,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={22} color="#fff" />
      </Pressable>

      {onDeletePost ? (
        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete post"
          style={{
            position: 'absolute',
            top: 48,
            left: 20,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: deleting ? 0.5 : 1,
          }}
        >
          {deleting ? <Spinner size="small" color="#fff" /> : <Trash2 size={20} color="#fff" />}
        </Pressable>
      ) : null}

      <View style={{ width: stage, maxHeight: '88%', borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface }}>
        <View style={{ width: stage, height: stage, backgroundColor: '#000' }}>
          {count > 1 ? (
            <FlatList
              data={post.mediaUrls}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `${post.id}-lb-${i}`}
              onScroll={onScroll}
              scrollEventThrottle={16}
              renderItem={({ item, index: i }) => (
                <View style={{ width: stage, height: stage }}>
                  {/* Lightbox always requests the full/original resolution. */}
                  <PostMedia
                    url={item}
                    variants={post.mediaObjects?.[i]}
                    size="full"
                    resizeMode="contain"
                    controls
                  />
                </View>
              )}
            />
          ) : (
            <PostMedia
              url={post.mediaUrls[0]!}
              variants={post.mediaObjects?.[0]}
              size="full"
              resizeMode="contain"
              controls
            />
          )}
          {count > 1 ? (
            <Row gap={5} style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }}>
              {post.mediaUrls.map((_, i) => (
                <View
                  key={`lbdot-${i}`}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                />
              ))}
            </Row>
          ) : null}
        </View>

        <View style={{ padding: 16, gap: 12 }}>
          {post.caption ? (
            <AppText variant="body" style={{ fontSize: 14 }}>
              {post.caption}
            </AppText>
          ) : (
            <AppText variant="body" muted style={{ fontStyle: 'italic' }}>
              No caption
            </AppText>
          )}
          <Row gap={18} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
            <Row gap={6}>
              <Heart
                size={20}
                color={post.likedByMe ? colors.primary : colors.textMuted}
                fill={post.likedByMe ? colors.primary : 'transparent'}
              />
              <AppText variant="body" weight="600" style={{ fontSize: 14 }}>
                {post.likeCount}
              </AppText>
              <AppText variant="body" muted style={{ fontSize: 14 }}>
                like{post.likeCount === 1 ? '' : 's'}
              </AppText>
            </Row>
            <Row gap={6}>
              <MessageCircle size={20} color={colors.textMuted} />
              <AppText variant="body" weight="600" style={{ fontSize: 14 }}>
                {post.commentCount}
              </AppText>
              <AppText variant="body" muted style={{ fontSize: 14 }}>
                comment{post.commentCount === 1 ? '' : 's'}
              </AppText>
            </Row>
          </Row>
        </View>
      </View>
    </View>
  );
}
