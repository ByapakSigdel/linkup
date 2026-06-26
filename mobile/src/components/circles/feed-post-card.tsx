// Instagram-style feed card for one circle post. Ported from
// apps/web/src/components/circles/feed-post-card.tsx. Header (circle avatar +
// @handle), swipeable media (single / carousel / video), optimistic like toggle,
// comment toggle, counts, caption, and an expandable comments section. Stays in
// sync with the shared socket for live like updates.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  FlatList,
  Alert,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import { Heart, MessageCircle, Trash2 } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, FadeIn, FadeOut } from 'react-native-reanimated';
import { Avatar, AppText, Row, Spinner } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import { CommentsSection } from './comments-section';
import { PostMedia } from './post-media';
import { timeAgo } from './helpers';
import type { CirclePost } from './types';

interface FeedPostCardProps {
  post: CirclePost;
  onUpdate?: (postId: string, patch: Partial<CirclePost>) => void;
  /** Owner-only: when set, the card shows a delete affordance in its header. */
  onDelete?: (post: CirclePost) => void | Promise<void>;
}

export function FeedPostCard({ post, onUpdate, onDelete }: FeedPostCardProps) {
  const { colors, radius } = useTheme();
  const { width } = useWindowDimensions();
  // Card spans the screen minus the 16px screen padding on each side.
  const mediaSize = Math.max(width - 32, 0);

  const routeKey = post.circle?.handle ?? post.circleId;
  const displayHandle = post.circle?.handle
    ? `@${post.circle.handle}`
    : post.circle?.name ?? post.authorName ?? 'Circle';

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [slide, setSlide] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  // Double-tap-to-like: track last tap timestamp + overlay visibility.
  const lastTapRef = useRef<number>(0);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const doubleTapScale = useSharedValue(0);
  const doubleTapStyle = useAnimatedStyle(() => ({ transform: [{ scale: doubleTapScale.value }] }));

  const media = post.mediaUrls ?? [];
  const isCarousel = media.length > 1;

  useEffect(() => {
    setLiked(post.likedByMe);
    setLikeCount(post.likeCount);
    setCommentCount(post.commentCount);
  }, [post.likedByMe, post.likeCount, post.commentCount]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleLiked = (payload: { postId: string; liked: boolean; likeCount: number }) => {
      if (payload.postId !== post.id) return;
      setLikeCount(payload.likeCount);
      onUpdate?.(post.id, { likeCount: payload.likeCount });
    };
    socket.on('circle:post:liked', handleLiked);
    return () => {
      socket.off('circle:post:liked', handleLiked);
    };
  }, [post.id, onUpdate]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setLikeCount(nextCount);
    if (nextLiked) {
      heartScale.value = withSequence(withTiming(1.3, { duration: 120 }), withTiming(1, { duration: 120 }));
    }
    onUpdate?.(post.id, { likedByMe: nextLiked, likeCount: nextCount });
    try {
      const res = await circlesApi.toggleLike(routeKey, post.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      onUpdate?.(post.id, { likedByMe: res.liked, likeCount: res.likeCount });
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      onUpdate?.(post.id, { likedByMe: prevLiked, likeCount: prevCount });
    } finally {
      setLiking(false);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    if (delta < 300) {
      // Second tap within 300 ms → like (only if not already liked; Instagram
      // also does nothing on double-tap when already liked).
      if (!liked) {
        void handleLike();
      }
      // Always show the heart pop so the gesture feels acknowledged.
      setDoubleTapHeart(true);
      doubleTapScale.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(1.3, { duration: 100 }),
        withTiming(1, { duration: 100 }),
      );
      setTimeout(() => setDoubleTapHeart(false), 700);
    }
  };

  const bumpCommentCount = () => {
    setCommentCount((c) => {
      const next = c + 1;
      onUpdate?.(post.id, { commentCount: next });
      return next;
    });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / mediaSize);
    if (i !== slide) setSlide(i);
  };

  const goToProfile = () => router.push(`/circles/${encodeURIComponent(routeKey)}`);

  const confirmDelete = () => {
    if (!onDelete || deleting) return;
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
              await onDelete(post);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      {/* Header */}
      <Row gap={12} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
        <Pressable onPress={goToProfile}>
          <Avatar
            uri={resolveMediaUrl(post.circle?.avatarUrl ?? post.authorAvatarUrl)}
            name={post.circle?.name ?? post.authorName ?? 'Circle'}
            size={40}
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Pressable onPress={goToProfile}>
            <AppText variant="label" numberOfLines={1}>
              {displayHandle}
            </AppText>
          </Pressable>
          <AppText variant="caption" muted>
            {timeAgo(post.createdAt)}
          </AppText>
        </View>
        {onDelete ? (
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete post"
            style={{ padding: 4, opacity: deleting ? 0.5 : 1 }}
          >
            {deleting ? <Spinner size="small" /> : <Trash2 size={20} color={colors.textMuted} />}
          </Pressable>
        ) : null}
      </Row>

      {/* Media */}
      {media.length > 0 ? (
        <Pressable
          onPress={handleDoubleTap}
          accessibilityLabel="Double-tap to like"
          style={{ width: mediaSize, height: mediaSize, backgroundColor: colors.background }}
        >
          {isCarousel ? (
            <>
              <FlatList
                data={media}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, i) => `${post.id}-m-${i}`}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item, index: i }) => (
                  <View style={{ width: mediaSize, height: mediaSize }}>
                    {/* Use medium (~1080px) variant in the feed for bandwidth. */}
                    <PostMedia
                      url={item}
                      variants={post.mediaObjects?.[i]}
                      size="medium"
                      resizeMode="cover"
                      controls={false}
                    />
                  </View>
                )}
              />
              <View style={{ position: 'absolute', top: 10, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <AppText style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>
                  {slide + 1}/{media.length}
                </AppText>
              </View>
              <Row gap={5} style={{ position: 'absolute', bottom: 12, alignSelf: 'center' }}>
                {media.map((_, i) => (
                  <View
                    key={`dot-${i}`}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: i === slide ? colors.primary : 'rgba(255,255,255,0.5)',
                    }}
                  />
                ))}
              </Row>
            </>
          ) : (
            <PostMedia
              url={media[0]!}
              variants={post.mediaObjects?.[0]}
              size="medium"
              resizeMode="cover"
              controls={isVideoSingle(media[0]!)}
              autoplay={isVideoSingle(media[0]!)}
            />
          )}

          {/* Double-tap heart overlay */}
          {doubleTapHeart ? (
            <Animated.View
              entering={FadeIn.duration(80)}
              exiting={FadeOut.duration(300)}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Animated.View style={doubleTapStyle}>
                <Heart size={80} color={colors.error} fill={colors.error} />
              </Animated.View>
            </Animated.View>
          ) : null}
        </Pressable>
      ) : null}

      {/* Actions */}
      <Row gap={18} style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <Pressable onPress={handleLike} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'}>
          <Animated.View style={heartStyle}>
            <Heart size={26} color={liked ? colors.error : colors.textMuted} fill={liked ? colors.error : 'transparent'} />
          </Animated.View>
        </Pressable>
        <Pressable onPress={() => setShowComments((s) => !s)} accessibilityRole="button" accessibilityLabel="Comments">
          <MessageCircle size={26} color={showComments ? colors.primary : colors.textMuted} />
        </Pressable>
      </Row>

      {/* Counts + caption */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingTop: 8, gap: 4 }}>
        {likeCount > 0 ? (
          <AppText variant="label">
            {likeCount} {likeCount === 1 ? 'like' : 'likes'}
          </AppText>
        ) : null}

        {post.caption ? (
          <AppText variant="body" style={{ fontSize: 14 }}>
            <AppText weight="700" style={{ fontSize: 14 }} onPress={goToProfile}>
              {displayHandle}{' '}
            </AppText>
            {post.caption}
          </AppText>
        ) : null}

        {commentCount > 0 && !showComments ? (
          <Pressable onPress={() => setShowComments(true)}>
            <AppText variant="caption" muted>
              View {commentCount === 1 ? '1 comment' : `all ${commentCount} comments`}
            </AppText>
          </Pressable>
        ) : null}

        {showComments ? (
          <CommentsSection
            circleIdOrHandle={routeKey}
            postId={post.id}
            onCommentAdded={bumpCommentCount}
          />
        ) : null}
      </View>
    </View>
  );
}

function isVideoSingle(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
