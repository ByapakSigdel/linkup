'use client';

// Couple PROFILE page (Instagram-for-couples). The route param `id` accepts a
// uuid OR an @handle — the backend resolves either via GET /circles/:idOrHandle.
// Composes ProfileHeader (avatar + optional story ring, counts, FollowButton or
// owner controls), an owner action bar (post composer / add story / edit), and a
// PostGrid. Private circles you don't follow render a locked state instead of
// posts. Realtime keeps counts, the grid and follow-state fresh.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Heart,
  ImagePlus,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button, Card, Input, Spinner } from '@/components/ui';
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
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

function sanitizeHandle(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

export default function CircleProfilePage() {
  const params = useParams<{ id: string }>();
  const idOrHandle = params?.id;
  const router = useRouter();

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
  const [error, setError] = useState<string | null>(null);

  // Infinite-scroll plumbing for the post grid (mirrors the home feed).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  // Owner affordances.
  const [showComposer, setShowComposer] = useState(false);
  const [addStoryOpen, setAddStoryOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Story viewer.
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);

  // §Phase2 DM — opening a conversation from the Message button.
  const [messaging, setMessaging] = useState(false);

  // The resolved circle id (uuid) once we have the profile — used to match
  // realtime payloads that always carry the canonical id (not the handle).
  const circleId = profile?.circle.id ?? null;
  const isOwner = profile?.isOwner ?? false;
  const canViewPosts = profile?.canViewPosts ?? false;

  // ─── Load profile (+ posts + stories when viewable) ──────────────────────────
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
        cursorRef.current = cur;
        setStories(storyRes.stories);
      } else {
        setPosts([]);
        setNextCursor(null);
        cursorRef.current = null;
        setStories([]);
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ||
        'Could not load this circle. It may have been removed.';
      setError(message);
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

  // ─── Realtime: events scoped to THIS circle ──────────────────────────────────
  useEffect(() => {
    if (!circleId || !couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onNewPost = (payload: { circleId: string; post: CirclePost }) => {
      if (payload.circleId !== circleId) return;
      const raw = payload.post;
      if (!raw?.id) return;
      setPosts((prev) =>
        prev.some((p) => p.id === raw.id) ? prev : [raw, ...prev],
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              circle: { ...prev.circle, postCount: prev.circle.postCount + 1 },
            }
          : prev,
      );
    };

    const onPostDeleted = (payload: { circleId: string; postId: string }) => {
      if (payload.circleId !== circleId) return;
      setPosts((prev) => prev.filter((p) => p.id !== payload.postId));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              circle: {
                ...prev.circle,
                postCount: Math.max(prev.circle.postCount - 1, 0),
              },
            }
          : prev,
      );
    };

    const onLiked = (payload: {
      circleId: string;
      postId: string;
      userId: string;
      liked: boolean;
      likeCount: number;
    }) => {
      if (payload.circleId !== circleId) return;
      const mine = user?.id === payload.userId;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? {
                ...p,
                likeCount: payload.likeCount,
                likedByMe: mine ? payload.liked : p.likedByMe,
              }
            : p,
        ),
      );
    };

    const onComment = (payload: { circleId: string; postId: string }) => {
      if (payload.circleId !== circleId) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === payload.postId
            ? { ...p, commentCount: p.commentCount + 1 }
            : p,
        ),
      );
    };

    // A follow-state change toward this circle (accepted/removed) can flip what
    // we're allowed to see — refetch the whole profile to settle counts + posts.
    const onFollowResolved = (payload?: {
      circle?: { id?: string };
      circleId?: string;
    }) => {
      const targetId = payload?.circle?.id ?? payload?.circleId;
      if (targetId && targetId !== circleId) return;
      void loadProfile();
    };

    const onNewStory = (payload: { circleId: string }) => {
      if (payload.circleId !== circleId) return;
      if (!canViewPosts) return;
      circlesApi
        .getCircleStories(idOrHandle as string)
        .then((res) => setStories(res.stories))
        .catch(() => {});
    };

    // Owner cross-partner sync: when the partner posts/deletes/edits, refetch.
    const onSelfUpdated = () => {
      if (!isOwner) return;
      void loadProfile();
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

  // ─── Active stories → a tray for the StoryViewer + ring state ─────────────────
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
    setStories((prev) =>
      prev.map((s) => (s.id === story.id ? { ...s, viewedByMe: true } : s)),
    );
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handlePosted = useCallback((post: CirclePost) => {
    setPosts((prev) => [post, ...prev]);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            circle: { ...prev.circle, postCount: prev.circle.postCount + 1 },
          }
        : prev,
    );
    setShowComposer(false);
  }, []);

  const handleStoryAdded = useCallback(
    (story: Story) => {
      // Only reflect it on-page if this profile is mine.
      if (isOwner) setStories((prev) => [...prev, story]);
    },
    [isOwner],
  );

  const handleFollowChange = useCallback(
    (state: FollowState) => {
      // A newly-accepted follow unlocks posts/stories — pull them in.
      if (state === 'accepted' && !canViewPosts) {
        void loadProfile();
      }
      // Unfollowing a private circle re-locks it.
      if (state === 'none' && profile?.circle.isPrivate && !isOwner) {
        setProfile((prev) =>
          prev ? { ...prev, followState: 'none', canViewPosts: false } : prev,
        );
        setPosts([]);
        setStories([]);
      }
    },
    [canViewPosts, isOwner, profile?.circle.isPrivate, loadProfile],
  );

  const loadMore = useCallback(async () => {
    if (!idOrHandle || loadingMoreRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { posts: more, nextCursor: cur } = await circlesApi.getCirclePosts(
        idOrHandle,
        { cursor },
      );
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(cur);
      cursorRef.current = cur;
    } catch {
      // Non-fatal: leave the existing grid; the sentinel can retry on re-scroll.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [idOrHandle]);

  // Infinite scroll via an IntersectionObserver on the sentinel (matches feed).
  useEffect(() => {
    if (!canViewPosts) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canViewPosts, loadMore, nextCursor]);

  const handleDeletePost = useCallback(
    async (post: CirclePost) => {
      const snapshot = posts;
      // Optimistically remove the post + decrement the profile count.
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              circle: {
                ...prev.circle,
                postCount: Math.max(prev.circle.postCount - 1, 0),
              },
            }
          : prev,
      );
      try {
        await circlesApi.deletePost(post.id);
        pushToast({
          title: 'Post deleted',
          body: 'Your post has been removed.',
          variant: 'success',
        });
      } catch (err) {
        // Roll back on failure.
        setPosts(snapshot);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                circle: {
                  ...prev.circle,
                  postCount: prev.circle.postCount + 1,
                },
              }
            : prev,
        );
        pushToast({
          title: 'Could not delete post',
          body:
            (err as { response?: { data?: { error?: { message?: string } } } })
              ?.response?.data?.error?.message || 'Please try again.',
        });
      }
    },
    [posts, pushToast],
  );

  const handleEdited = useCallback(
    (circle: CircleProfileResponse['circle']) => {
      setProfile((prev) => (prev ? { ...prev, circle } : prev));
      setEditOpen(false);
    },
    [],
  );

  // §Phase2 DM — find-or-create the conversation, then open the thread. 403 if
  // mutual follow was lost since the button rendered.
  const handleMessage = useCallback(async () => {
    if (!idOrHandle || messaging) return;
    setMessaging(true);
    try {
      const { conversation } = await circlesApi.openConversation(idOrHandle);
      router.push(`/circles/messages/${conversation.id}`);
    } catch (err) {
      pushToast({
        title: 'Could not open chat',
        body:
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message || 'Please try again.',
      });
    } finally {
      setMessaging(false);
    }
  }, [idOrHandle, messaging, router, pushToast]);

  // ─── Not paired ──────────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-text">
              Link up with your partner first
            </h2>
            <p className="max-w-sm text-sm text-text-muted">
              Pair with your partner to follow other couples and share your own
              circle.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  // ─── Error / not found ───────────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <BackLink />
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-error">{error || 'Circle not found.'}</p>
            <Button variant="outline" size="sm" onClick={() => void loadProfile()}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const routeKey = profile.circle.handle ?? profile.circle.id;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <BackLink />

      <ProfileHeader
        profile={profile}
        hasStories={hasUnseenStories}
        storiesSeen={hasSeenStories}
        onOpenStories={tray ? () => setStoryViewerOpen(true) : undefined}
        onEdit={isOwner ? () => setEditOpen(true) : undefined}
        onFollowChange={handleFollowChange}
        followersHref={
          isOwner
            ? `/circles/${encodeURIComponent(routeKey)}/followers`
            : undefined
        }
        followingHref={
          isOwner
            ? `/circles/${encodeURIComponent(routeKey)}/following`
            : undefined
        }
        onMessage={!isOwner ? handleMessage : undefined}
        messaging={messaging}
      />

      {/* Owner action bar */}
      {isOwner && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={showComposer ? 'outline' : 'primary'}
            onClick={() => setShowComposer((v) => !v)}
          >
            {showComposer ? (
              <>
                <X className="h-4 w-4" />
                Close
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                New post
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddStoryOpen(true)}
          >
            <ImagePlus className="h-4 w-4" />
            Add to story
          </Button>
        </div>
      )}

      {/* Owner: inline composer */}
      {isOwner && showComposer && (
        <PostComposer
          onPosted={handlePosted}
          onCancel={() => setShowComposer(false)}
        />
      )}

      {/* Owner: inline edit */}
      {isOwner && editOpen && (
        <EditCircleForm
          circle={profile.circle}
          onSaved={handleEdited}
          onCancel={() => setEditOpen(false)}
        />
      )}

      <div className="border-t border-border pt-5">
        {canViewPosts ? (
          <>
            <PostGrid
              posts={posts}
              loading={postsLoading}
              onDeletePost={isOwner ? handleDeletePost : undefined}
              emptyLabel={
                isOwner
                  ? 'Share your first photo with your followers.'
                  : 'No posts yet.'
              }
            />

            {/* Infinite-scroll sentinel + loader (matches the home feed). */}
            <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
            {loadingMore && (
              <div className="flex justify-center pt-6">
                <Spinner size="md" className="text-primary" />
              </div>
            )}
            {posts.length > 0 && !nextCursor && (
              <p className="pt-6 text-center text-xs text-text-muted">
                You&apos;re all caught up.
              </p>
            )}
          </>
        ) : (
          <LockedState
            isPending={profile.followState === 'pending'}
            name={profile.circle.name}
          />
        )}
      </div>

      {/* Add-story sheet (owner) */}
      <AddStorySheet
        open={addStoryOpen}
        onClose={() => setAddStoryOpen(false)}
        onAdded={handleStoryAdded}
      />

      {/* Story viewer */}
      {storyViewerOpen && tray && (
        <StoryViewer
          trays={tray}
          ownerCircleId={isOwner ? profile.circle.id : null}
          onClose={() => setStoryViewerOpen(false)}
          onStoryViewed={handleStoryViewed}
        />
      )}
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/circles"
      className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to circles
    </Link>
  );
}

function LockedState({
  isPending,
  name,
}: {
  isPending: boolean;
  name: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-active text-text-muted">
        <Lock className="h-6 w-6" />
      </span>
      <h3 className="text-base font-semibold text-text">This circle is private</h3>
      <p className="max-w-xs text-sm text-text-muted">
        {isPending
          ? `Your request to follow ${name} is pending. You'll see their posts once they accept.`
          : `Follow ${name} to see their photos and stories.`}
      </p>
    </div>
  );
}

// Inline owner edit form (no dedicated component exported — PATCH /circles/me).
function EditCircleForm({
  circle,
  onSaved,
  onCancel,
}: {
  circle: CircleProfileResponse['circle'];
  onSaved: (circle: CircleProfileResponse['circle']) => void;
  onCancel: () => void;
}) {
  const pushToast = useToastStore((s) => s.push);
  const coupleId = useAuthStore((s) => s.couple?.id ?? null);
  const [handle, setHandle] = useState(circle.handle ?? '');
  const [name, setName] = useState(circle.name);
  const [bio, setBio] = useState(circle.bio ?? '');
  const [cover, setCover] = useState<string | null>(circle.coverImageUrl ?? null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleValid = HANDLE_RE.test(handle);
  const coverChanged = (cover ?? '') !== (circle.coverImageUrl ?? '');
  const dirty =
    handle !== (circle.handle ?? '') ||
    name.trim() !== circle.name ||
    bio.trim() !== (circle.bio ?? '') ||
    coverChanged;

  const handleCoverSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-selecting the same file
      if (!file || !file.type.startsWith('image/')) return;
      if (!coupleId) {
        setErr('We could not find your couple. Please reload and try again.');
        return;
      }
      setUploadingCover(true);
      setErr(null);
      try {
        const uploaded = await circlesApi.uploadMedia(file, coupleId);
        setCover(uploaded.media.cdnUrl);
      } catch (error) {
        setErr(
          (error as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ||
            'Could not upload the cover image. Please try again.',
        );
      } finally {
        setUploadingCover(false);
      }
    },
    [coupleId],
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
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
        pushToast({
          title: 'Profile updated',
          body: 'Your circle changes are live.',
          variant: 'success',
        });
        onSaved(updated);
      } catch (error) {
        setErr(
          (error as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ||
            'Could not save. Please try again.',
        );
      } finally {
        setSaving(false);
      }
    },
    [handle, handleValid, name, bio, cover, coverChanged, circle.handle, onSaved, pushToast],
  );

  return (
    <Card cardStyle="bordered" padding="md">
      <form onSubmit={submit} className="space-y-4">
        <h3 className="font-display text-base font-semibold text-text">
          Edit profile
        </h3>

        {/* Cover image (§1.7) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">
            Cover image{' '}
            <span className="font-normal text-text-muted">(optional)</span>
          </label>
          {cover ? (
            <div className="relative overflow-hidden rounded-xl bg-surface-active">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt="Cover preview"
                className="h-32 w-full object-cover sm:h-40"
              />
              <div className="absolute right-2 top-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover || saving}
                  aria-label="Change cover image"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-white backdrop-blur-sm transition-colors hover:bg-background/80 disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCover(null)}
                  disabled={uploadingCover || saving}
                  aria-label="Remove cover image"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-background/60 text-white backdrop-blur-sm transition-colors hover:bg-background/80 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {uploadingCover && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                  <Spinner size="md" className="text-white" />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover || saving}
              className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-primary/60 hover:bg-surface-hover disabled:opacity-50 sm:h-40"
            >
              {uploadingCover ? (
                <Spinner size="md" className="text-primary" />
              ) : (
                <>
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Add a cover banner</span>
                </>
              )}
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
            onChange={handleCoverSelect}
            className="hidden"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-handle" className="text-sm font-medium text-text">
            Handle
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              @
            </span>
            <Input
              id="edit-handle"
              value={handle}
              onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
              placeholder="usandyou"
              className="pl-7"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
            />
          </div>
        </div>

        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam & Alex"
          maxLength={60}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-bio" className="text-sm font-medium text-text">
            Bio <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A little about the two of you…"
            rows={3}
            maxLength={280}
            className={cn(
              'w-full resize-none rounded-[var(--lk-input-radius)] border border-border bg-transparent px-3.5 py-2 text-sm text-text placeholder:text-text-muted transition-all',
              'focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20',
            )}
          />
        </div>

        {err && (
          <p className="text-sm text-error" role="alert">
            {err}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            loading={saving}
            disabled={!handleValid || !dirty || uploadingCover}
          >
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
