'use client';

// Circles HOME — the Instagram-for-couples home screen.
//
// Flow:
//  - Not paired => the shared "link up with your partner" empty state.
//  - getMyCircle() returns circle:null => opt-in hero with CreateCircleForm
//    (explains what a circle is, then swaps to the feed once created).
//  - Otherwise => StoryRing tray on top, then an infinite-scroll feed of
//    FeedPostCard from getFeed(). Header links to Discover, My Profile and
//    Requests (with a pending badge).
//
// Realtime (shared socket, cleaned up on unmount):
//  - circle:post:new   => prepend the new post to the feed.
//  - circle:post:deleted => drop it from the feed.
//  - circle:story:new  => the StoryRing handles its own ring refresh; here we
//    just keep the feed coherent.
//  - follow:accepted   => a private circle we requested just accepted us, so
//    refetch the feed to pull in their posts.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Compass, Heart, Inbox, Sparkles, UserCircle } from 'lucide-react';
import { Button, buttonVariants, Card, Spinner } from '@/components/ui';
import {
  CreateCircleForm,
  FeedPostCard,
  StoryRing,
  type CircleProfileResponse,
  type FeedPost,
} from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';

export default function CirclesPage() {
  const couple = useAuthStore((s) => s.couple);

  // My-circle profile gate (null circle => show the opt-in CTA).
  const [myCircle, setMyCircle] =
    useState<CircleProfileResponse['circle'] | null>(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  // Feed state.
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Mirror the cursor for the IntersectionObserver callback (avoids re-binding).
  const cursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  // ─── My circle (gate) ────────────────────────────────────────────────────
  const loadMyCircle = useCallback(async () => {
    setMeLoading(true);
    setMeError(null);
    try {
      const res = await circlesApi.getMyCircle();
      setMyCircle(res.circle);
      setPendingRequestCount(res.pendingRequestCount ?? 0);
    } catch (err: unknown) {
      setMeError(
        errMessage(err, 'Could not load your circle. Please try again.'),
      );
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

  // ─── Feed ────────────────────────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const { posts: next, nextCursor: cursor } = await circlesApi.getFeed();
      setPosts(next);
      setNextCursor(cursor);
      cursorRef.current = cursor;
    } catch (err: unknown) {
      setFeedError(errMessage(err, 'Could not load your feed.'));
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { posts: more, nextCursor: cursorNext } = await circlesApi.getFeed({
        cursor,
      });
      setPosts((prev) => {
        // De-dupe in case realtime already prepended one of these.
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(cursorNext);
      cursorRef.current = cursorNext;
    } catch {
      // Non-fatal: leave the existing feed; the sentinel can retry on re-scroll.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // Load the feed once we know a circle exists.
  useEffect(() => {
    if (myCircle) void loadFeed();
  }, [myCircle, loadFeed]);

  // Infinite scroll via an IntersectionObserver on the sentinel.
  useEffect(() => {
    if (!myCircle) return;
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
  }, [myCircle, loadMore, nextCursor]);

  // ─── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myCircle) return;
    const socket = getSocket();
    if (!socket) return;

    const onNewPost = (payload: { circleId: string; post: FeedPost }) => {
      if (!payload?.post) return;
      setPosts((prev) => {
        if (prev.some((p) => p.id === payload.post.id)) return prev;
        return [payload.post, ...prev];
      });
    };

    const onPostDeleted = (payload: { postId: string }) => {
      if (!payload?.postId) return;
      setPosts((prev) => prev.filter((p) => p.id !== payload.postId));
    };

    // A circle we requested to follow just accepted us: pull in their posts.
    const onFollowAccepted = () => {
      void loadFeed();
    };

    socket.on('circle:post:new', onNewPost);
    socket.on('circle:post:deleted', onPostDeleted);
    socket.on('follow:accepted', onFollowAccepted);
    return () => {
      socket.off('circle:post:new', onNewPost);
      socket.off('circle:post:deleted', onPostDeleted);
      socket.off('follow:accepted', onFollowAccepted);
    };
  }, [myCircle, loadFeed]);

  // Persist per-post like/comment count changes bubbled up from a card.
  const handlePostUpdate = useCallback(
    (postId: string, patch: Partial<FeedPost>) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  // ─── Not paired ──────────────────────────────────────────────────────────
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
              Circles are a shared profile for the two of you. Pair with your
              partner to create yours and start sharing.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Loading the gate ──────────────────────────────────────────────────────
  if (meLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // ─── Gate error ────────────────────────────────────────────────────────────
  if (meError) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-6">
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-error">{meError}</p>
            <Button variant="outline" size="sm" onClick={loadMyCircle}>
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ─── Opt-in CTA (no circle yet) ───────────────────────────────────────────
  if (!myCircle) {
    return (
      <div className="mx-auto max-w-xl space-y-6 p-4 md:p-6">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-primary via-secondary to-accent text-text-on-primary">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-text">
            Start your circle
          </h1>
          <p className="mx-auto max-w-md text-sm text-text-muted">
            A circle is one shared profile for the two of you — your own corner
            of LinkUp to post photos, share 24-hour stories, and follow other
            couples. Pick a @handle to claim yours.
          </p>
        </div>

        <CreateCircleForm
          onCreated={(circle) => {
            setMyCircle(circle);
          }}
        />
      </div>
    );
  }

  // ─── Home (story tray + feed) ───────────────────────────────────────────────
  const myProfileHref = `/circles/${encodeURIComponent(
    myCircle.handle ?? myCircle.id,
  )}`;

  return (
    <div className="mx-auto max-w-xl space-y-2 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Circles
          </p>
          <h1 className="font-display text-2xl font-bold text-text">Home</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/circles/discover"
            aria-label="Discover circles"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Compass className="h-5 w-5" />
          </Link>
          <Link
            href="/circles/requests"
            aria-label="Follow requests"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <Inbox className="h-5 w-5" />
            {pendingRequestCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-text-on-primary">
                {pendingRequestCount > 9 ? '9+' : pendingRequestCount}
              </span>
            )}
          </Link>
          <Link
            href={myProfileHref}
            aria-label="My circle profile"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          >
            <UserCircle className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Story tray */}
      <div className="border-b border-border">
        <StoryRing />
      </div>

      {/* Feed */}
      {feedLoading && posts.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : feedError && posts.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-error">{feedError}</p>
            <Button variant="outline" size="sm" onClick={loadFeed}>
              Retry
            </Button>
          </div>
        </Card>
      ) : posts.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Compass className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text">
              Your feed is quiet
            </h3>
            <p className="max-w-sm text-sm text-text-muted">
              Follow other couples to see their posts here. Discover circles to
              get started.
            </p>
            <Link href="/circles/discover" className={buttonVariants({ size: 'sm' })}>
              <Compass className="h-4 w-4" />
              Discover circles
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-5 pt-3">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              onUpdate={handlePostUpdate}
            />
          ))}

          {/* Infinite-scroll sentinel + loader */}
          <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Spinner size="md" />
            </div>
          )}
          {!nextCursor && (
            <p className="py-6 text-center text-xs text-text-muted">
              You&apos;re all caught up.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Pull a server error message out of an axios error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message || fallback
  );
}
