// Couple PROFILE page (mobile port of
// apps/web/src/app/(dashboard)/circles/[id]/page.tsx). Route param `id` accepts a
// uuid OR an @handle. ProfileHeader (avatar + story ring, counts, follow/owner
// controls), owner action bar (new post / add story / edit), and a PostGrid.
// Private circles you don't follow render a locked state. Realtime keeps counts,
// the grid and follow-state fresh.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Image, Pressable, TextInput, useWindowDimensions, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Heart, ImagePlus, Lock, Plus, X, Trash2 } from 'lucide-react-native';
import { Screen, AppText, Button, Card, EmptyState, Input, Row, Skeleton, Spinner } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { resolveMediaUrl } from '@/lib/env';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import {
  ProfileHeader,
  PostComposer,
  PostGrid,
  AddStorySheet,
  StoryViewer,
  type CircleProfileResponse,
  type CirclePost,
  type FollowState,
  type Story,
  type StoryTray,
} from '@/components/circles';
import { isHandleValid, sanitizeHandle, errMessage, assetToUploadFile } from '@/components/circles/helpers';

export default function CircleProfileScreen() {
  const { colors } = useTheme();
  const { isTablet, gridColumns } = useResponsive();
  // On tablets, cap the profile column so the header + grid don't sprawl, but
  // keep it wide enough for a denser grid than the phone's 3-up.
  const PROFILE_WIDTH = 900;
  const gridColumnCount = isTablet ? gridColumns : 3;
  const { width: winWidth } = useWindowDimensions();
  // The grid lives inside the centered, capped profile column.
  const gridWidth = isTablet ? Math.min(winWidth, PROFILE_WIDTH) : winWidth;
  const params = useLocalSearchParams<{ id: string }>();
  const idOrHandle = params?.id;

  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);

  const [profile, setProfile] = useState<CircleProfileResponse | null>(null);
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showComposer, setShowComposer] = useState(false);
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const circleId = profile?.circle.id ?? null;
  const isOwner = profile?.isOwner ?? false;
  const canViewPosts = profile?.canViewPosts ?? false;
  const routeKey = profile ? profile.circle.handle ?? profile.circle.id : idOrHandle;

  const loadProfile = useCallback(async () => {
    if (!idOrHandle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await circlesApi.getCircle(idOrHandle);
      setProfile(res);
      if (res.canViewPosts) {
        setPostsLoading(true);
        const [{ posts: list, nextCursor: cur }, storyRes] = await Promise.all([
          circlesApi.getCirclePosts(idOrHandle),
          circlesApi.getCircleStories(idOrHandle).catch(() => ({ stories: [] })),
        ]);
        setPosts(list);
        setNextCursor(cur);
        setStories(storyRes.stories);
      } else {
        setPosts([]);
        setNextCursor(null);
        setStories([]);
      }
    } catch (err) {
      setError(errMessage(err, 'Could not load this circle. It may have been removed.'));
      setProfile(null);
    } finally {
      setLoading(false);
      setPostsLoading(false);
    }
  }, [idOrHandle]);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    void loadProfile();
  }, [couple?.isPaired, loadProfile]);

  // Realtime scoped to THIS circle.
  useEffect(() => {
    if (!circleId || !couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onNewPost = (payload: { circleId: string; post: CirclePost }) => {
      if (payload.circleId !== circleId) return;
      const raw = payload.post;
      if (!raw?.id) return;
      setPosts((prev) => (prev.some((p) => p.id === raw.id) ? prev : [raw, ...prev]));
      setProfile((prev) =>
        prev ? { ...prev, circle: { ...prev.circle, postCount: prev.circle.postCount + 1 } } : prev,
      );
    };
    const onPostDeleted = (payload: { circleId: string; postId: string }) => {
      if (payload.circleId !== circleId) return;
      setPosts((prev) => prev.filter((p) => p.id !== payload.postId));
      setProfile((prev) =>
        prev ? { ...prev, circle: { ...prev.circle, postCount: Math.max(prev.circle.postCount - 1, 0) } } : prev,
      );
    };
    const onLiked = (payload: { circleId: string; postId: string; userId: string; liked: boolean; likeCount: number }) => {
      if (payload.circleId !== circleId) return;
      const mine = user?.id === payload.userId;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? { ...p, likeCount: payload.likeCount, likedByMe: mine ? payload.liked : p.likedByMe }
            : p,
        ),
      );
    };
    const onComment = (payload: { circleId: string; postId: string }) => {
      if (payload.circleId !== circleId) return;
      setPosts((prev) => prev.map((p) => (p.id === payload.postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
    };
    const onFollowResolved = (payload?: { circle?: { id?: string }; circleId?: string }) => {
      const targetId = payload?.circle?.id ?? payload?.circleId;
      if (targetId && targetId !== circleId) return;
      void loadProfile();
    };
    const onNewStory = (payload: { circleId: string }) => {
      if (payload.circleId !== circleId || !canViewPosts || !idOrHandle) return;
      circlesApi.getCircleStories(idOrHandle).then((res) => setStories(res.stories)).catch(() => {});
    };
    const onSelfUpdated = () => {
      if (isOwner) void loadProfile();
    };

    socket.on('circle:post:new', onNewPost);
    socket.on('circle:post:deleted', onPostDeleted);
    socket.on('circle:post:liked', onLiked);
    socket.on('circle:comment:new', onComment);
    socket.on('follow:accepted', onFollowResolved);
    socket.on('follow:removed', onFollowResolved);
    socket.on('circle:story:new', onNewStory);
    socket.on('circle:self:updated', onSelfUpdated);
    return () => {
      socket.off('circle:post:new', onNewPost);
      socket.off('circle:post:deleted', onPostDeleted);
      socket.off('circle:post:liked', onLiked);
      socket.off('circle:comment:new', onComment);
      socket.off('follow:accepted', onFollowResolved);
      socket.off('follow:removed', onFollowResolved);
      socket.off('circle:story:new', onNewStory);
      socket.off('circle:self:updated', onSelfUpdated);
    };
  }, [circleId, couple?.isPaired, user?.id, canViewPosts, isOwner, idOrHandle, loadProfile]);

  const activeStories = useMemo(
    () => stories.filter((s) => new Date(s.expiresAt).getTime() > Date.now()),
    [stories],
  );
  const hasUnseenStories = activeStories.some((s) => s.viewedByMe !== true);
  const hasSeenStories = activeStories.length > 0 && !hasUnseenStories;

  const tray: StoryTray | null = useMemo(() => {
    if (!profile || activeStories.length === 0) return null;
    return {
      circle: {
        id: profile.circle.id,
        handle: profile.circle.handle,
        name: profile.circle.name,
        avatarUrl: profile.circle.avatarUrl,
      },
      stories: activeStories,
      hasUnseen: hasUnseenStories,
      latestAt: activeStories[activeStories.length - 1]?.createdAt ?? null,
    };
  }, [profile, activeStories, hasUnseenStories]);

  const handleStoryViewed = useCallback((story: Story) => {
    setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewedByMe: true } : s)));
  }, []);

  const handlePosted = useCallback((post: CirclePost) => {
    setPosts((prev) => [post, ...prev]);
    setProfile((prev) =>
      prev ? { ...prev, circle: { ...prev.circle, postCount: prev.circle.postCount + 1 } } : prev,
    );
    setShowComposer(false);
  }, []);

  const handleStoryAdded = useCallback(
    (story: Story) => {
      if (isOwner) setStories((prev) => [...prev, story]);
    },
    [isOwner],
  );

  const handleFollowChange = useCallback(
    (state: FollowState) => {
      if (state === 'accepted' && !canViewPosts) void loadProfile();
      if (state === 'none' && profile?.circle.isPrivate && !isOwner) {
        setProfile((prev) => (prev ? { ...prev, followState: 'none', canViewPosts: false } : prev));
        setPosts([]);
        setStories([]);
      }
    },
    [canViewPosts, isOwner, profile?.circle.isPrivate, loadProfile],
  );

  const loadMore = useCallback(async () => {
    if (!idOrHandle || !nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { posts: more, nextCursor: cur } = await circlesApi.getCirclePosts(idOrHandle, { cursor: nextCursor });
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(cur);
    } catch {
      pushToast({ title: 'Could not load more posts', body: 'Please try again.' });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [idOrHandle, nextCursor, pushToast]);

  const handleDeletePost = useCallback(
    async (post: CirclePost) => {
      const snapshot = posts;
      // Optimistically remove the post + decrement the profile count.
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setProfile((prev) =>
        prev ? { ...prev, circle: { ...prev.circle, postCount: Math.max(prev.circle.postCount - 1, 0) } } : prev,
      );
      try {
        await circlesApi.deletePost(post.id);
        pushToast({ title: 'Post deleted', body: 'Your post has been removed.', variant: 'success' });
      } catch (err) {
        // Roll back on failure.
        setPosts(snapshot);
        setProfile((prev) =>
          prev ? { ...prev, circle: { ...prev.circle, postCount: prev.circle.postCount + 1 } } : prev,
        );
        pushToast({ title: 'Could not delete post', body: errMessage(err, 'Please try again.') });
      }
    },
    [posts, pushToast],
  );

  const handleEdited = useCallback((circle: CircleProfileResponse['circle']) => {
    setProfile((prev) => (prev ? { ...prev, circle } : prev));
    setEditOpen(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  // §Phase2 DM: find-or-create a conversation with this circle (403 unless
  // mutual — the button only renders for mutuals) and open the thread.
  const handleMessage = useCallback(async () => {
    if (!idOrHandle || messaging) return;
    setMessaging(true);
    try {
      const { conversation } = await circlesApi.openConversation(idOrHandle);
      router.push(`/circles/messages/${conversation.id}`);
    } catch (err) {
      pushToast({ title: 'Could not open chat', body: errMessage(err, 'Please try again.') });
    } finally {
      setMessaging(false);
    }
  }, [idOrHandle, messaging, pushToast]);

  // ─── Not paired ──────────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Circle" />
        <EmptyState
          icon={<Heart color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Pair with your partner to follow other couples and share your own circle."
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Circle" />
        <View style={{ gap: 20, paddingTop: 8 }}>
          <Row gap={20}>
            <Skeleton width={88} height={88} radius={44} />
            <View style={{ flex: 1, gap: 12 }}>
              <Skeleton width={160} height={20} />
              <Row gap={28}>
                <Skeleton width={40} height={28} />
                <Skeleton width={40} height={28} />
                <Skeleton width={40} height={28} />
              </Row>
            </View>
          </Row>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
            {[...Array(9)].map((_, i) => (
              <Skeleton key={i} width={110} height={110} radius={0} />
            ))}
          </View>
        </View>
      </Screen>
    );
  }

  if (error || !profile) {
    return (
      <Screen>
        <ScreenHeader title="Circle" />
        <Card variant="bordered">
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
            <AppText color={colors.error} center>{error || 'Circle not found.'}</AppText>
            <Button variant="outline" size="sm" onPress={() => void loadProfile()} label="Retry" />
          </View>
        </Card>
      </Screen>
    );
  }

  // Shared header content for the post grid / locked state. Rendered as the
  // FlatList ListHeaderComponent (§1.4) so it scrolls with the virtualized grid.
  const headerContent = (
    <View style={{ gap: 20, paddingBottom: 16 }}>
      <ProfileHeader
        profile={profile}
        hasStories={hasUnseenStories}
        storiesSeen={hasSeenStories}
        onOpenStories={tray ? () => setStoryViewerOpen(true) : undefined}
        onEdit={isOwner ? () => setEditOpen(true) : undefined}
        onFollowChange={handleFollowChange}
        onOpenFollowers={isOwner ? () => router.push(`/circles/${encodeURIComponent(routeKey)}/followers`) : undefined}
        onOpenFollowing={isOwner ? () => router.push(`/circles/${encodeURIComponent(routeKey)}/following`) : undefined}
        onMessage={handleMessage}
        messaging={messaging}
      />

      {/* Owner action bar */}
      {isOwner ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Button
            size="sm"
            variant={showComposer ? 'outline' : 'primary'}
            onPress={() => setShowComposer((v) => !v)}
            leftIcon={
              showComposer ? <X size={16} color={colors.text} /> : <Plus size={16} color={colors.textOnPrimary} />
            }
            label={showComposer ? 'Close' : 'New post'}
          />
          <Button
            size="sm"
            variant="outline"
            onPress={() => setAddStoryOpen(true)}
            leftIcon={<ImagePlus size={16} color={colors.text} />}
            label="Add to story"
          />
        </Row>
      ) : null}

      {isOwner && showComposer ? (
        <PostComposer onPosted={handlePosted} onCancel={() => setShowComposer(false)} />
      ) : null}

      {isOwner && editOpen ? (
        <EditCircleForm circle={profile.circle} onSaved={handleEdited} onCancel={() => setEditOpen(false)} />
      ) : null}

      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }} />
    </View>
  );

  const refreshCtl = (
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
  );

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? PROFILE_WIDTH : undefined, alignSelf: 'center' }}>
        <ScreenHeader title={profile.circle.handle ? `@${profile.circle.handle}` : profile.circle.name} />
      </View>

      {canViewPosts ? (
        <PostGrid
          posts={posts}
          loading={postsLoading}
          columns={gridColumnCount}
          containerWidth={gridWidth}
          emptyLabel={isOwner ? 'Share your first photo with your followers.' : 'No posts yet.'}
          onDeletePost={isOwner ? handleDeletePost : undefined}
          ListHeaderComponent={headerContent}
          refreshControl={refreshCtl}
          onEndReached={() => void loadMore()}
          loadingMore={loadingMore}
          hasMore={!!nextCursor}
          maxWidth={isTablet ? PROFILE_WIDTH : undefined}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            gap: 20,
            width: '100%',
            maxWidth: isTablet ? PROFILE_WIDTH : undefined,
            alignSelf: 'center',
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshCtl}
        >
          {headerContent}
          <LockedState isPending={profile.followState === 'pending'} name={profile.circle.name} />
        </ScrollView>
      )}

      <AddStorySheet open={addStoryOpen} onClose={() => setAddStoryOpen(false)} onAdded={handleStoryAdded} />

      {storyViewerOpen && tray ? (
        <StoryViewer
          trays={tray}
          ownerCircleId={isOwner ? profile.circle.id : null}
          onClose={() => setStoryViewerOpen(false)}
          onStoryViewed={handleStoryViewed}
        />
      ) : null}
    </Screen>
  );
}

function LockedState({ isPending, name }: { isPending: boolean; name: string }) {
  const { colors } = useTheme();
  return (
    <EmptyState
      icon={<Lock color={colors.textMuted} size={36} />}
      title="This circle is private"
      subtitle={
        isPending
          ? `Your request to follow ${name} is pending. You'll see their posts once they accept.`
          : `Follow ${name} to see their photos and stories.`
      }
    />
  );
}

function EditCircleForm({
  circle,
  onSaved,
  onCancel,
}: {
  circle: CircleProfileResponse['circle'];
  onSaved: (circle: CircleProfileResponse['circle']) => void;
  onCancel: () => void;
}) {
  const { colors, radius } = useTheme();
  const pushToast = useToastStore((s) => s.push);
  const coupleId = useAuthStore((s) => s.couple?.id ?? null);
  const [handle, setHandle] = useState(circle.handle ?? '');
  const [name, setName] = useState(circle.name);
  const [bio, setBio] = useState(circle.bio ?? '');
  const [cover, setCover] = useState<string | null>(circle.coverImageUrl ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleValid = isHandleValid(handle);
  const coverChanged = (cover ?? '') !== (circle.coverImageUrl ?? '');
  const dirty =
    handle !== (circle.handle ?? '') ||
    name.trim() !== circle.name ||
    bio.trim() !== (circle.bio ?? '') ||
    coverChanged;

  const pickCover = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      pushToast({ title: 'Permission needed', body: 'Allow photo access to set a cover image.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    if (!coupleId) {
      setErr('We could not find your couple. Please reload and try again.');
      return;
    }
    setUploadingCover(true);
    setErr(null);
    try {
      const uploaded = await circlesApi.uploadMedia(assetToUploadFile(result.assets[0]), coupleId);
      setCover(uploaded.media.cdnUrl);
    } catch (error) {
      setErr(errMessage(error, 'Could not upload the cover image. Please try again.'));
    } finally {
      setUploadingCover(false);
    }
  }, [coupleId, pushToast]);

  const submit = useCallback(async () => {
    if (!handleValid) {
      setErr('Handle must be 3-30 lowercase letters, numbers or underscores.');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const { circle: updated } = await circlesApi.updateMyCircle({
        handle: handle !== (circle.handle ?? '') ? handle : undefined,
        name: name.trim() || undefined,
        bio: bio.trim(),
        coverImageUrl: coverChanged ? cover : undefined,
      });
      pushToast({ title: 'Profile updated', body: 'Your circle changes are live.', variant: 'success' });
      onSaved(updated);
    } catch (error) {
      setErr(errMessage(error, 'Could not save. Please try again.'));
    } finally {
      setSaving(false);
    }
  }, [handle, handleValid, name, bio, cover, coverChanged, circle.handle, onSaved, pushToast]);

  const coverPreview = cover ? resolveMediaUrl(cover) : null;

  return (
    <Card variant="bordered" style={{ gap: 16 }}>
      <AppText variant="subtitle">Edit profile</AppText>

      {/* Cover image (§1.7) */}
      <View style={{ gap: 6 }}>
        <AppText variant="label">
          Cover image <AppText variant="label" muted>(optional)</AppText>
        </AppText>
        {coverPreview ? (
          <View style={{ borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surfaceHover }}>
            <Image source={{ uri: coverPreview }} style={{ width: '100%', height: 120 }} resizeMode="cover" />
            <Row gap={8} style={{ position: 'absolute', top: 8, right: 8 }}>
              <Pressable
                onPress={pickCover}
                disabled={uploadingCover || saving}
                accessibilityLabel="Change cover image"
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
              >
                <ImagePlus size={16} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setCover(null)}
                disabled={uploadingCover || saving}
                accessibilityLabel="Remove cover image"
                style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Trash2 size={16} color="#fff" />
              </Pressable>
            </Row>
            {uploadingCover ? (
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
                <Spinner size="small" color="#fff" />
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={pickCover}
            disabled={uploadingCover || saving}
            style={{
              height: 120,
              borderRadius: radius.card,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {uploadingCover ? (
              <Spinner size="small" />
            ) : (
              <>
                <ImagePlus size={22} color={colors.textMuted} />
                <AppText variant="caption" muted>Add a cover banner</AppText>
              </>
            )}
          </Pressable>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <AppText variant="label">Handle</AppText>
        <View style={{ justifyContent: 'center' }}>
          <AppText muted style={{ position: 'absolute', left: 14, zIndex: 1 }}>@</AppText>
          <TextInput
            value={handle}
            onChangeText={(t) => setHandle(sanitizeHandle(t))}
            placeholder="usandyou"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={30}
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.input,
              paddingLeft: 28,
              paddingRight: 14,
              paddingVertical: 12,
              fontSize: 15,
              color: colors.text,
            }}
          />
        </View>
      </View>

      <Input label="Name" value={name} onChangeText={setName} placeholder="Sam & Alex" maxLength={60} />

      <View style={{ gap: 6 }}>
        <AppText variant="label">
          Bio <AppText variant="label" muted>(optional)</AppText>
        </AppText>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="A little about the two of you…"
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={280}
          style={{
            backgroundColor: colors.background,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.input,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.text,
            minHeight: 72,
            textAlignVertical: 'top',
          }}
        />
      </View>

      {err ? (
        <AppText variant="caption" color={colors.error}>{err}</AppText>
      ) : null}

      <Row gap={8} style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" onPress={onCancel} disabled={saving} label="Cancel" />
        <Button size="sm" onPress={submit} loading={saving} disabled={!handleValid || !dirty || uploadingCover} label="Save changes" />
      </Row>
    </Card>
  );
}
