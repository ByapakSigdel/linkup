'use client';

// ConnectionsList — owner-only paginated list of the caller's circle followers
// or following (§1.6). Consumes GET /circles/me/followers and
// /circles/me/following via the circles API. Rendered by the
// circles/[id]/followers and following pages.
//
// Each row is a CircleCard (avatar, @handle, embedded FollowButton). Infinite
// scroll via an IntersectionObserver sentinel, matching the home feed pattern.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import * as circlesApi from '@/lib/circles-api';
import { CircleCard } from './circle-card';
import type { CircleSummary, FollowState } from './types';

export type ConnectionsKind = 'followers' | 'following';

interface ConnectionsListProps {
  kind: ConnectionsKind;
}

export function ConnectionsList({ kind }: ConnectionsListProps) {
  const [items, setItems] = useState<CircleSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  // Normalize the followers/following responses into a common shape so the rest
  // of the component is kind-agnostic.
  const fetchPage = useCallback(
    async (
      cursor?: string,
    ): Promise<{ list: CircleSummary[]; nextCursor: string | null }> => {
      if (kind === 'followers') {
        const res = await circlesApi.getFollowers(cursor ? { cursor } : undefined);
        return { list: res.followers, nextCursor: res.nextCursor };
      }
      const res = await circlesApi.getFollowing(cursor ? { cursor } : undefined);
      return { list: res.following, nextCursor: res.nextCursor };
    },
    [kind],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { list, nextCursor: cursor } = await fetchPage();
      setItems(list);
      setNextCursor(cursor);
      cursorRef.current = cursor;
    } catch {
      setError('Could not load this list. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { list: more, nextCursor: cursor2 } = await fetchPage(cursor);
      setItems((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(cursor2);
      cursorRef.current = cursor2;
    } catch {
      // Non-fatal: the sentinel can retry on re-scroll.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage]);

  // Infinite scroll via an IntersectionObserver on the sentinel.
  useEffect(() => {
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
  }, [loadMore, nextCursor]);

  const handleFollowChange = useCallback((id: string, state: FollowState) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, followState: state } : c)));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card cardStyle="bordered" padding="lg">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-error">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card cardStyle="bordered" padding="lg">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-active text-text-muted">
            <Users className="h-6 w-6" />
          </span>
          <h3 className="text-base font-semibold text-text">
            {kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </h3>
          <p className="max-w-xs text-sm text-text-muted">
            {kind === 'followers'
              ? 'When other couples follow your circle, they will appear here.'
              : 'Circles your couple follows will appear here. Discover couples to start following.'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((circle) => (
          <CircleCard
            key={circle.id}
            circle={circle}
            onFollowChange={handleFollowChange}
          />
        ))}
      </div>

      {/* Infinite-scroll sentinel + loader */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}
    </>
  );
}
