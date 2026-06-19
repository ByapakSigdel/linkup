'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageSquare, Heart } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import {
  CircleHeader,
  MembersList,
  PostComposer,
  PostCard,
  type CircleDetail,
  type CircleMemberView,
  type CirclePostView,
  type CircleCommentView,
  type CircleStats,
} from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import { useToastStore } from '@/stores/toast-store';
import api from '@/lib/api';

const EMPTY_COMMENTS: CircleCommentView[] = [];

export default function CircleDetailPage() {
  const params = useParams<{ id: string }>();
  const circleId = params?.id;
  const router = useRouter();

  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);
  const coupleId = couple?.id;

  const [circle, setCircle] = useState<CircleDetail | null>(null);
  const [members, setMembers] = useState<CircleMemberView[]>([]);
  const [posts, setPosts] = useState<CirclePostView[]>([]);
  const [stats, setStats] = useState<CircleStats>({
    memberCount: 0,
    postCount: 0,
    activityScore: 0,
  });
  const [liveCommentsByPost, setLiveCommentsByPost] = useState<
    Record<string, CircleCommentView[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comment ids whose count we've already applied (dedup across POST + socket).
  const countedComments = useRef<Set<string>>(new Set());
  // Post ids we authored locally, so we don't double-prepend on socket echo.
  const knownPostIds = useRef<Set<string>>(new Set());

  // ─── Load circle details ──────────────────────────────────────────────────
  const fetchDetails = useCallback(async () => {
    if (!circleId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/circles/${circleId}`);
      const d = data.data;
      const c = d.circle;
      setCircle({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        coverImageUrl: c.coverImageUrl ?? null,
        inviteCode: c.inviteCode ?? null,
        isPrivate: c.isPrivate ?? true,
        memberCount: c.memberCount ?? 0,
        postCount: c.postCount ?? 0,
        isAdmin: c.isAdmin ?? false,
        createdByCoupleId: c.createdByCoupleId ?? null,
      });
      setMembers(d.members ?? []);
      const recent: CirclePostView[] = (d.recentPosts ?? []).map((p: any) => ({
        id: p.id,
        content: p.content,
        type: p.type ?? 'post',
        authorName: p.authorName ?? null,
        authorAvatarUrl: p.authorAvatarUrl ?? null,
        likeCount: p.likeCount ?? 0,
        commentCount: p.commentCount ?? 0,
        likedByMe: p.likedByMe ?? false,
        createdAt: p.createdAt,
        mediaUrls: p.mediaUrls ?? [],
      }));
      knownPostIds.current = new Set(recent.map((p) => p.id));
      setPosts(recent);
      setStats(
        d.stats ?? {
          memberCount: c.memberCount ?? 0,
          postCount: c.postCount ?? 0,
          activityScore: 0,
        },
      );
      setError(null);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Could not load this circle. You may not be a member.',
      );
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    fetchDetails();
  }, [couple?.isPaired, fetchDetails]);

  // ─── Helpers to mutate feed state ─────────────────────────────────────────
  const patchPost = useCallback(
    (postId: string, patch: Partial<CirclePostView>) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  /** Bump a post's comment count at most once per comment id. */
  const registerComment = useCallback((postId: string, commentId: string) => {
    if (countedComments.current.has(commentId)) return;
    countedComments.current.add(commentId);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    );
  }, []);

  // ─── Realtime: events for THIS circle only ────────────────────────────────
  useEffect(() => {
    if (!circleId || !couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onPost = (payload: { circleId: string; post: any }) => {
      if (payload.circleId !== circleId) return;
      const raw = payload.post;
      if (!raw?.id || knownPostIds.current.has(raw.id)) return;
      knownPostIds.current.add(raw.id);
      const post: CirclePostView = {
        id: raw.id,
        content: raw.content,
        type: raw.type ?? 'post',
        authorName: raw.authorName ?? null,
        authorAvatarUrl: raw.authorAvatarUrl ?? null,
        likeCount: raw.likeCount ?? 0,
        commentCount: raw.commentCount ?? 0,
        likedByMe: raw.likedByMe ?? false,
        createdAt: raw.createdAt ?? new Date().toISOString(),
        mediaUrls: raw.mediaUrls ?? [],
      };
      setPosts((prev) => [post, ...prev]);
      setStats((s) => ({
        ...s,
        postCount: s.postCount + 1,
        activityScore: s.activityScore + 2,
      }));
    };

    const onLiked = (payload: {
      circleId: string;
      postId: string;
      userId: string;
      liked: boolean;
      likeCount: number;
    }) => {
      if (payload.circleId !== circleId) return;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== payload.postId) return p;
          // Only override likedByMe for the current user's own actions.
          const isMine = user?.id === payload.userId;
          return {
            ...p,
            likeCount: payload.likeCount,
            likedByMe: isMine ? payload.liked : p.likedByMe,
          };
        }),
      );
    };

    const onComment = (payload: {
      circleId: string;
      postId: string;
      comment: any;
    }) => {
      if (payload.circleId !== circleId) return;
      const raw = payload.comment;
      if (!raw?.id) return;
      const comment: CircleCommentView = {
        id: raw.id,
        content: raw.content,
        userId: raw.userId,
        createdAt: raw.createdAt ?? new Date().toISOString(),
        authorName: raw.authorName ?? null,
        authorAvatarUrl: raw.authorAvatarUrl ?? null,
      };
      // Feed any open CommentsSection (dedup happens there).
      setLiveCommentsByPost((prev) => ({
        ...prev,
        [payload.postId]: [...(prev[payload.postId] ?? []), comment],
      }));
      // Bump the count once.
      registerComment(payload.postId, comment.id);
    };

    const onMemberJoined = (payload: { circleId: string }) => {
      if (payload.circleId !== circleId) return;
      setStats((s) => ({
        ...s,
        memberCount: s.memberCount + 1,
        activityScore: s.activityScore + 1,
      }));
      // Refresh the members list so the new couple shows up.
      fetchDetails();
      useToastStore.getState().push({
        title: 'New circle member',
        body: 'A couple just joined this circle.',
      });
    };

    socket.on('circle:post', onPost);
    socket.on('circle:post:liked', onLiked);
    socket.on('circle:comment', onComment);
    socket.on('circle:member:joined', onMemberJoined);

    return () => {
      socket.off('circle:post', onPost);
      socket.off('circle:post:liked', onLiked);
      socket.off('circle:comment', onComment);
      socket.off('circle:member:joined', onMemberJoined);
    };
  }, [circleId, couple?.isPaired, user?.id, registerComment, fetchDetails]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handlePosted = (post: CirclePostView) => {
    knownPostIds.current.add(post.id);
    setPosts((prev) => [post, ...prev]);
    setStats((s) => ({
      ...s,
      postCount: s.postCount + 1,
      activityScore: s.activityScore + 2,
    }));
  };

  // ─── Not paired ───────────────────────────────────────────────────────────
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
              Pair with your partner to join circles and share posts together.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Error / not a member ─────────────────────────────────────────────────
  if (error || !circle) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <Link
          href="/circles"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to circles
        </Link>
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-error">
              {error || 'Circle not found.'}
            </p>
            <Button variant="outline" size="sm" onClick={fetchDetails}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isAdmin = circle.isAdmin ?? false;
  const isCreator =
    !!coupleId && circle.createdByCoupleId === coupleId;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* Back link */}
      <Link
        href="/circles"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to circles
      </Link>

      <CircleHeader
        circle={circle}
        stats={stats}
        isAdmin={isAdmin}
        isCreator={isCreator}
        onUpdated={(patch) =>
          setCircle((prev) => (prev ? { ...prev, ...patch } : prev))
        }
        onDeleted={() => router.push('/circles')}
        onLeft={() => router.push('/circles')}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Feed column */}
        <div className="space-y-4">
          <PostComposer circleId={circle.id} onPosted={handlePosted} />

          {posts.length === 0 ? (
            <Card cardStyle="bordered" padding="lg">
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-text">
                  No posts yet
                </h3>
                <p className="max-w-xs text-sm text-text-muted">
                  Be the first to share something with this circle.
                </p>
              </div>
            </Card>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                circleId={circle.id}
                post={post}
                liveComments={liveCommentsByPost[post.id] ?? EMPTY_COMMENTS}
                onUpdate={(patch) => patchPost(post.id, patch)}
                onCommentRegistered={registerComment}
              />
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <MembersList members={members} />
        </div>
      </div>
    </div>
  );
}
