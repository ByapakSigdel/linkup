// Circles HOME — the Instagram-for-couples home screen (mobile port of
// apps/web/src/app/(dashboard)/circles/page.tsx).
//
//  - Not paired => "link up with your partner" empty state.
//  - getMyCircle() returns circle:null => opt-in hero with CreateCircleForm.
//  - Otherwise => StoryRing tray on top, then an infinite-scroll feed.
//
// Realtime: circle:post:new (prepend), circle:post:deleted (drop),
// follow:accepted (refetch feed).

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Compass, Heart, Inbox, Sparkles, UserCircle } from 'lucide-react-native';
import { Screen, AppText, Button, Card, Spinner, EmptyState, Touchable, Row, Badge, Skeleton } from '@/components/ui';
import { AppBar } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import {
  CreateCircleForm,
  FeedPostCard,
  StoryRing,
  type CircleProfileResponse,
  type FeedPost,
} from '@/components/circles';
import { errMessage } from '@/components/circles/helpers';

export default function CirclesScreen() {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const FEED_WIDTH = 680;
  const couple = useAuthStore((s) => s.couple);

  const [myCircle, setMyCircle] = useState<CircleProfileResponse['circle'] | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const loadMyCircle = useCallback(async () => {
    setMeLoading(true);
    setMeError(null);
    try {
      const res = await circlesApi.getMyCircle();
      setMyCircle(res.circle);
      setPendingRequestCount(res.pendingRequestCount ?? 0);
    } catch (err) {
      setMeError(errMessage(err, 'Could not load your circle. Please try again.'));
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!couple?.isPaired) {
      setMeLoading(false);
      return;
    }
    void loadMyCircle();
  }, [couple?.isPaired, loadMyCircle]);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const { posts: next, nextCursor: cursor } = await circlesApi.getFeed();
      setPosts(next);
      setNextCursor(cursor);
    } catch (err) {
      setFeedError(errMessage(err, 'Could not load your feed.'));
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { posts: more, nextCursor: cursorNext } = await circlesApi.getFeed({ cursor: nextCursor });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(cursorNext);
    } catch {
      // Non-fatal.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    if (myCircle) void loadFeed();
  }, [myCircle, loadFeed]);

  // Realtime.
  useEffect(() => {
    if (!myCircle) return;
    const socket = getSocket();
    if (!socket) return;

    const onNewPost = (payload: { circleId: string; post: FeedPost }) => {
      if (!payload?.post) return;
      setPosts((prev) => (prev.some((p) => p.id === payload.post.id) ? prev : [payload.post, ...prev]));
    };
    const onPostDeleted = (payload: { postId: string }) => {
      if (!payload?.postId) return;
      setPosts((prev) => prev.filter((p) => p.id !== payload.postId));
    };
    const onFollowAccepted = () => void loadFeed();

    socket.on('circle:post:new', onNewPost);
    socket.on('circle:post:deleted', onPostDeleted);
    socket.on('follow:accepted', onFollowAccepted);
    return () => {
      socket.off('circle:post:new', onNewPost);
      socket.off('circle:post:deleted', onPostDeleted);
      socket.off('follow:accepted', onFollowAccepted);
    };
  }, [myCircle, loadFeed]);

  const handlePostUpdate = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  // ─── Not paired ────────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <Screen>
        <AppBar title="Circles" />
        <EmptyState
          icon={<Heart color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Circles are a shared profile for the two of you. Pair with your partner to create yours and start sharing."
        />
      </Screen>
    );
  }

  // ─── Loading the gate ──────────────────────────────────────────────────────
  if (meLoading) {
    return (
      <Screen>
        <AppBar title="Circles" />
        <View style={{ gap: 16 }}>
          <Row gap={16}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <Skeleton width={64} height={64} radius={32} />
                <Skeleton width={48} height={10} />
              </View>
            ))}
          </Row>
          <Skeleton height={320} radius={16} />
          <Skeleton height={320} radius={16} />
        </View>
      </Screen>
    );
  }

  // ─── Gate error ────────────────────────────────────────────────────────────
  if (meError) {
    return (
      <Screen>
        <AppBar title="Circles" />
        <Card variant="bordered">
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
            <AppText color={colors.error} center>{meError}</AppText>
            <Button variant="outline" size="sm" onPress={loadMyCircle} label="Retry" />
          </View>
        </Card>
      </Screen>
    );
  }

  // ─── Opt-in CTA (no circle yet) ─────────────────────────────────────────────
  if (!myCircle) {
    return (
      <Screen scroll maxWidth={isTablet ? 560 : undefined}>
        <View style={{ gap: 24, paddingVertical: 8 }}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={28} color={colors.textOnPrimary} />
            </View>
            <AppText variant="display" center>Start your circle</AppText>
            <AppText muted center style={{ maxWidth: 360 }}>
              A circle is one shared profile for the two of you — your own corner of LinkUp to post photos, share 24-hour stories, and follow other couples. Pick a @handle to claim yours.
            </AppText>
          </View>
          <CreateCircleForm onCreated={(circle) => setMyCircle(circle)} />
        </View>
      </Screen>
    );
  }

  const myRouteKey = myCircle.handle ?? myCircle.id;

  const headerActions = (
    <Row gap={4}>
      <Touchable onPress={() => router.push('/circles/discover')} accessibilityLabel="Discover circles" style={{ padding: 6 }}>
        <Compass size={22} color={colors.textMuted} />
      </Touchable>
      <Touchable onPress={() => router.push('/circles/requests')} accessibilityLabel="Follow requests" style={{ padding: 6 }}>
        <View>
          <Inbox size={22} color={colors.textMuted} />
          {pendingRequestCount > 0 ? (
            <View style={{ position: 'absolute', top: -6, right: -6 }}>
              <Badge label={pendingRequestCount > 9 ? '9+' : pendingRequestCount} />
            </View>
          ) : null}
        </View>
      </Touchable>
      <Touchable onPress={() => router.push(`/circles/${encodeURIComponent(myRouteKey)}`)} accessibilityLabel="My circle profile" style={{ padding: 6 }}>
        <UserCircle size={22} color={colors.textMuted} />
      </Touchable>
    </Row>
  );

  const ListHeader = (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 4 }}>
      <StoryRing />
    </View>
  );

  const emptyFeed =
    feedLoading && posts.length === 0 ? (
      <View style={{ gap: 16, paddingTop: 12 }}>
        <Skeleton height={320} radius={16} />
        <Skeleton height={320} radius={16} />
      </View>
    ) : feedError && posts.length === 0 ? (
      <Card variant="bordered" style={{ marginTop: 12 }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
          <AppText color={colors.error} center>{feedError}</AppText>
          <Button variant="outline" size="sm" onPress={loadFeed} label="Retry" />
        </View>
      </Card>
    ) : (
      <EmptyState
        icon={<Compass color={colors.primary} size={40} />}
        title="Your feed is quiet"
        subtitle="Follow other couples to see their posts here. Discover circles to get started."
        action={<Button size="sm" leftIcon={<Compass size={16} color={colors.textOnPrimary} />} onPress={() => router.push('/circles/discover')} label="Discover circles" />}
      />
    );

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? FEED_WIDTH : undefined, alignSelf: 'center' }}>
        <AppBar title="Home" right={headerActions} />
      </View>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          gap: 20,
          width: '100%',
          maxWidth: isTablet ? FEED_WIDTH : undefined,
          alignSelf: 'center',
        }}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={emptyFeed}
        renderItem={({ item }) => <FeedPostCard post={item} onUpdate={handlePostUpdate} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          posts.length > 0 ? (
            loadingMore ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <Spinner size="small" />
              </View>
            ) : !nextCursor ? (
              <AppText variant="caption" muted center style={{ paddingVertical: 20 }}>
                You&apos;re all caught up.
              </AppText>
            ) : null
          ) : null
        }
      />
    </Screen>
  );
}
