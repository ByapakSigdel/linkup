// PostGrid — Instagram-style 3-column thumbnail grid of a circle's posts.
// Ported from apps/web/src/components/circles/post-grid.tsx. Tapping a thumbnail
// opens a full-screen lightbox modal with carousel paging, caption, and counts.

import { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
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
} from 'lucide-react-native';
import { AppText, Spinner, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { PostMedia } from './post-media';
import type { CirclePost } from './types';

export interface PostGridProps {
  posts: CirclePost[];
  loading?: boolean;
  emptyLabel?: string;
}

const COLS = 3;
const GAP = 2;

export function PostGrid({ posts, loading = false, emptyLabel = 'No posts yet' }: PostGridProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 32 - GAP * (COLS - 1)) / COLS);
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openId) ?? null;

  if (loading && posts.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 64 }}>
        <Spinner size="large" />
      </View>
    );
  }

  if (posts.length === 0) {
    return (
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
  }

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {posts.map((post) => {
          const cover = post.mediaUrls[0];
          const isMulti = post.mediaUrls.length > 1;
          return (
            <Pressable
              key={post.id}
              onPress={() => setOpenId(post.id)}
              accessibilityRole="button"
              accessibilityLabel="Open post"
              style={{ width: cell, height: cell, backgroundColor: colors.surfaceActive, overflow: 'hidden' }}
            >
              {cover ? (
                <PostMedia url={cover} resizeMode="cover" />
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
        })}
      </View>

      <Modal visible={!!openPost} transparent animationType="fade" onRequestClose={() => setOpenId(null)}>
        {openPost ? <Lightbox post={openPost} onClose={() => setOpenId(null)} /> : null}
      </Modal>
    </>
  );
}

function Lightbox({ post, onClose }: { post: CirclePost; onClose: () => void }) {
  const { colors, radius } = useTheme();
  const { width } = useWindowDimensions();
  const stage = Math.min(width, 480);
  const [index, setIndex] = useState(0);
  const count = post.mediaUrls.length;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / stage);
    if (i !== index) setIndex(i);
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
              renderItem={({ item }) => (
                <View style={{ width: stage, height: stage }}>
                  <PostMedia url={item} resizeMode="contain" controls />
                </View>
              )}
            />
          ) : (
            <PostMedia url={post.mediaUrls[0]!} resizeMode="contain" controls />
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
