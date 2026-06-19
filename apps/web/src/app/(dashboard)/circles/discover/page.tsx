'use client';

// Circles › Discover — find couple circles to follow.
// A debounced search bar queries GET /circles/discover?q=…; an empty query
// surfaces suggested PUBLIC circles ordered by follower count. Each result is a
// CircleCard with an embedded FollowButton. Realtime follow:accepted /
// follow:removed events keep follow states in sync while the page is open.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Compass, Search, Heart, Sparkles, UserPlus } from 'lucide-react';
import { Button, buttonVariants, Card, Input, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CircleCard, type CircleProfile, type FollowState } from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';

export default function DiscoverPage() {
  const couple = useAuthStore((s) => s.couple);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [circles, setCircles] = useState<CircleProfile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // null = unknown (not yet fetched); true/false once /circles/me resolves.
  const [hasOwnCircle, setHasOwnCircle] = useState<boolean | null>(null);

  // Guard against out-of-order responses when the query changes quickly.
  const requestIdRef = useRef(0);

  // ── Debounce the search input (300ms). ─────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // ── Whether the viewer owns a circle (needed before they can follow). ──────
  useEffect(() => {
    if (!couple?.isPaired) return;
    let cancelled = false;
    circlesApi
      .getMyCircle()
      .then((me) => {
        if (!cancelled) setHasOwnCircle(!!me.circle);
      })
      .catch(() => {
        // Unknown — don't block discovery; the follow action enforces it.
        if (!cancelled) setHasOwnCircle(true);
      });
    return () => {
      cancelled = true;
    };
  }, [couple?.isPaired]);

  // ── Fetch results whenever the debounced query changes. ────────────────────
  const fetchResults = useCallback(async (q: string) => {
    const rid = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { circles: results, nextCursor: cursor } = await circlesApi.discover(
        q ? { q } : undefined,
      );
      if (rid !== requestIdRef.current) return; // a newer request superseded us
      setCircles(results);
      setNextCursor(cursor);
    } catch {
      if (rid !== requestIdRef.current) return;
      setError('Could not load circles. Please try again.');
      setCircles([]);
      setNextCursor(null);
    } finally {
      if (rid === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    fetchResults(debouncedQuery);
  }, [couple?.isPaired, debouncedQuery, fetchResults]);

  // ── Load more (cursor pagination). ─────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { circles: more, nextCursor: cursor } = await circlesApi.discover({
        ...(debouncedQuery ? { q: debouncedQuery } : {}),
        cursor: nextCursor,
      });
      setCircles((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(cursor);
    } catch {
      // Swallow — the user can retry by scrolling/clicking again.
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, debouncedQuery]);

  // ── Keep a row's follow state synced when something follows/unfollows. ──────
  const handleFollowChange = useCallback((id: string, state: FollowState) => {
    setCircles((prev) =>
      prev.map((c) => (c.id === id ? { ...c, followState: state } : c)),
    );
  }, []);

  // ── Realtime: reflect accept/remove on visible rows. ───────────────────────
  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const matchId = (payload: { circle?: { id?: string; handle?: string | null } }) => {
      const c = payload?.circle;
      if (!c) return null;
      return c.id ?? c.handle ?? null;
    };

    const onAccepted = (payload: { circle?: { id?: string; handle?: string | null } }) => {
      const key = matchId(payload);
      if (!key) return;
      setCircles((prev) =>
        prev.map((c) =>
          c.id === key || c.handle === key ? { ...c, followState: 'accepted' } : c,
        ),
      );
    };
    const onRemoved = (payload: { circle?: { id?: string; handle?: string | null } }) => {
      const key = matchId(payload);
      if (!key) return;
      setCircles((prev) =>
        prev.map((c) =>
          c.id === key || c.handle === key ? { ...c, followState: 'none' } : c,
        ),
      );
    };

    socket.on('follow:accepted', onAccepted);
    socket.on('follow:removed', onRemoved);
    return () => {
      socket.off('follow:accepted', onAccepted);
      socket.off('follow:removed', onRemoved);
    };
  }, [couple?.isPaired]);

  // ── Not paired: same empty state as other dashboard pages. ─────────────────
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
              Discover other couples to follow once you and your partner are
              paired. Pair up to start exploring circles.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const isSearching = debouncedQuery.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Couple Circles
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-text">
          <Compass className="h-6 w-6 text-primary" />
          Discover
        </h1>
        <p className="text-text-muted">
          Find other couples to follow and add to your feed
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          inputStyle="filled"
          size="lg"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by handle, name, or bio…"
          aria-label="Search circles"
          className="pl-10"
        />
      </div>

      {/* Prompt to create own circle (so the Follow buttons actually work). */}
      {hasOwnCircle === false && (
        <Card cardStyle="bordered" padding="md">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">
                  Create your circle to start following
                </p>
                <p className="text-sm text-text-muted">
                  You need your own couple circle before you can follow others.
                </p>
              </div>
            </div>
            <Link
              href="/circles"
              className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
            >
              Create circle
            </Link>
          </div>
        </Card>
      )}

      {/* Section label */}
      {!loading && !error && circles.length > 0 && (
        <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {isSearching ? (
            <>Results</>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Suggested for you
            </>
          )}
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-error">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchResults(debouncedQuery)}
            >
              Retry
            </Button>
          </div>
        </Card>
      ) : circles.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Compass className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text">
              {isSearching ? 'No circles found' : 'Nothing to discover yet'}
            </h3>
            <p className="max-w-md text-sm text-text-muted">
              {isSearching
                ? `We couldn't find any circles matching "${debouncedQuery}". Try a different handle or name.`
                : 'There are no public circles to suggest right now. Check back soon as more couples join.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {circles.map((circle) => (
              <CircleCard
                key={circle.id}
                circle={circle}
                onFollowChange={handleFollowChange}
              />
            ))}
          </div>

          {nextCursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                loading={loadingMore}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
