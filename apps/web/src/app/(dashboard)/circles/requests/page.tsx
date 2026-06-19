'use client';

// Follow Requests — for a private-circle owner. Lists pending incoming follow
// requests (GET /circles/me/requests) as rows with Accept / Decline actions
// (POST .../accept | .../decline) with optimistic removal. New requests arrive
// in real time via the `follow:request` gateway event and are prepended.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Heart, Lock, UserCheck, X } from 'lucide-react';
import { Avatar, Button, Card, Spinner } from '@/components/ui';
import * as circlesApi from '@/lib/circles-api';
import type { CircleSummary, FollowRequest } from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';

// `follow:request` realtime payload (see CirclesService.fanOut).
interface FollowRequestEvent {
  followId: string;
  followerCircle: CircleSummary;
  pendingRequestCount?: number;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  return `${wk}w ago`;
}

export default function CircleRequestsPage() {
  const couple = useAuthStore((s) => s.couple);

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track follow ids currently being accepted/declined so buttons disable.
  const [busy, setBusy] = useState<Record<string, 'accept' | 'decline'>>({});

  // Guard against duplicate inserts (realtime can race the fetch).
  const seenRef = useRef<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { requests: list } = await circlesApi.getRequests();
      seenRef.current = new Set(list.map((r) => r.followId));
      setRequests(list);
      setError(null);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
        'Could not load your follow requests. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    fetchRequests();
  }, [couple?.isPaired, fetchRequests]);

  // Realtime: prepend newly-arriving requests.
  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onRequest = (payload: FollowRequestEvent) => {
      if (!payload?.followId || !payload.followerCircle) return;
      if (seenRef.current.has(payload.followId)) return;
      seenRef.current.add(payload.followId);
      setRequests((prev) => [
        {
          followId: payload.followId,
          circle: payload.followerCircle,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    };

    // If a request is resolved elsewhere (or cancelled), drop it from the list.
    const onResolved = (payload: { followId?: string }) => {
      if (!payload?.followId) return;
      seenRef.current.delete(payload.followId);
      setRequests((prev) => prev.filter((r) => r.followId !== payload.followId));
    };

    socket.on('follow:request', onRequest);
    socket.on('follow:accepted', onResolved);
    socket.on('follow:removed', onResolved);
    return () => {
      socket.off('follow:request', onRequest);
      socket.off('follow:accepted', onResolved);
      socket.off('follow:removed', onResolved);
    };
  }, [couple?.isPaired]);

  const removeRequest = useCallback((followId: string) => {
    seenRef.current.delete(followId);
    setRequests((prev) => prev.filter((r) => r.followId !== followId));
  }, []);

  const handleAccept = useCallback(
    async (req: FollowRequest) => {
      if (busy[req.followId]) return;
      setBusy((b) => ({ ...b, [req.followId]: 'accept' }));
      // Optimistic removal — restore on failure.
      const snapshot = requests;
      removeRequest(req.followId);
      try {
        await circlesApi.acceptRequest(req.followId);
      } catch (err) {
        setRequests(snapshot);
        seenRef.current.add(req.followId);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ??
          'Could not accept that request. Please try again.';
        setError(message);
      } finally {
        setBusy((b) => {
          const next = { ...b };
          delete next[req.followId];
          return next;
        });
      }
    },
    [busy, requests, removeRequest],
  );

  const handleDecline = useCallback(
    async (req: FollowRequest) => {
      if (busy[req.followId]) return;
      setBusy((b) => ({ ...b, [req.followId]: 'decline' }));
      const snapshot = requests;
      removeRequest(req.followId);
      try {
        await circlesApi.declineRequest(req.followId);
      } catch (err) {
        setRequests(snapshot);
        seenRef.current.add(req.followId);
        const message =
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ??
          'Could not decline that request. Please try again.';
        setError(message);
      } finally {
        setBusy((b) => {
          const next = { ...b };
          delete next[req.followId];
          return next;
        });
      }
    },
    [busy, requests, removeRequest],
  );

  // Not paired — same empty state used across the dashboard.
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
              Follow requests are part of your couple&apos;s circle. Pair with
              your partner to start sharing.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/circles"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to my circle
        </Link>
        <div className="flex items-center gap-2 pt-1">
          <h1 className="font-display text-2xl font-bold text-text">
            Follow requests
          </h1>
          {requests.length > 0 && (
            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-text-on-primary">
              {requests.length}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-sm text-text-muted">
          <Lock className="h-3.5 w-3.5" />
          Couples waiting to follow your private circle
        </p>
      </div>

      {error && (
        <Card cardStyle="bordered" padding="md">
          <p className="text-sm text-error">{error}</p>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : requests.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover">
              <UserCheck className="h-8 w-8 text-text-muted" />
            </div>
            <h2 className="text-lg font-semibold text-text">All caught up</h2>
            <p className="max-w-sm text-sm text-text-muted">
              You have no pending follow requests right now. New requests will
              appear here the moment they arrive.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="space-y-2">
          {requests.map((req) => {
            const { circle } = req;
            const href = `/circles/${encodeURIComponent(circle.handle ?? circle.id)}`;
            const displayHandle = circle.handle ? `@${circle.handle}` : null;
            const state = busy[req.followId];
            return (
              <li key={req.followId}>
                <div
                  data-lk="card"
                  data-variant="bordered"
                  className="flex items-center gap-3 p-3 transition-all hover:border-border-focus hover:shadow-sm"
                >
                  <Link
                    href={href}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--lk-btn-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                  >
                    <Avatar
                      src={circle.avatarUrl}
                      name={circle.name}
                      size="lg"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-semibold text-text">
                        {circle.name}
                      </p>
                      {displayHandle && (
                        <p className="truncate text-xs text-text-muted">
                          {displayHandle}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-text-muted">
                        {timeAgo(req.createdAt)}
                      </p>
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleAccept(req)}
                      disabled={!!state}
                      aria-label={`Accept follow request from ${circle.name}`}
                    >
                      {state === 'accept' ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          <span className="hidden sm:inline">Accept</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecline(req)}
                      disabled={!!state}
                      aria-label={`Decline follow request from ${circle.name}`}
                    >
                      {state === 'decline' ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <X className="h-4 w-4" />
                          <span className="hidden sm:inline">Decline</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
