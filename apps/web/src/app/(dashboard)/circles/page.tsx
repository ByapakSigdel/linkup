'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, KeyRound, Heart } from 'lucide-react';
import { Button, Card, Spinner } from '@/components/ui';
import {
  CircleCard,
  CreateCircleForm,
  JoinCircleForm,
  type CircleListItem,
} from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';

export default function CirclesPage() {
  const couple = useAuthStore((s) => s.couple);

  const [circles, setCircles] = useState<CircleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  const fetchCircles = useCallback(async () => {
    try {
      const { data } = await api.get('/circles?type=all');
      const list: CircleListItem[] = (data.data.circles ?? []).map(
        (c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? null,
          coverImageUrl: c.coverImageUrl ?? null,
          memberCount: c.memberCount ?? 0,
          postCount: c.postCount ?? 0,
          isAdmin: c.isAdmin ?? false,
          inviteCode: c.inviteCode ?? null,
        }),
      );
      setCircles(list);
      setError(null);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Could not load your circles. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    fetchCircles();
  }, [couple?.isPaired, fetchCircles]);

  // Realtime: when a couple joins one of our circles, bump the member count.
  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onMemberJoined = (payload: { circleId: string }) => {
      setCircles((prev) =>
        prev.map((c) =>
          c.id === payload.circleId
            ? { ...c, memberCount: c.memberCount + 1 }
            : c,
        ),
      );
    };

    socket.on('circle:member:joined', onMemberJoined);
    return () => {
      socket.off('circle:member:joined', onMemberJoined);
    };
  }, [couple?.isPaired]);

  const handleCreated = (circle: CircleListItem) => {
    setCircles((prev) => [circle, ...prev]);
    setShowCreate(false);
  };

  const handleJoined = () => {
    setShowJoin(false);
    // Refetch so the newly joined circle (and its details) appears.
    fetchCircles();
  };

  // Not paired empty state.
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
              Couple Circles let you and other couples share posts together.
              Pair with your partner to start joining circles.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Couple Circles
          </p>
          <h1 className="font-display text-2xl font-bold text-text">Circles</h1>
          <p className="text-text-muted">
            Connect with other couples and share moments together
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowJoin((s) => !s);
              setShowCreate(false);
            }}
          >
            <KeyRound className="h-4 w-4" />
            Join with code
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowCreate((s) => !s);
              setShowJoin(false);
            }}
          >
            <Plus className="h-4 w-4" />
            Create circle
          </Button>
        </div>
      </div>

      {/* Forms */}
      {showCreate && (
        <CreateCircleForm
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}
      {showJoin && (
        <JoinCircleForm
          onJoined={handleJoined}
          onCancel={() => setShowJoin(false)}
          existingIds={circles.map((c) => c.id)}
        />
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
            <Button variant="outline" size="sm" onClick={fetchCircles}>
              Retry
            </Button>
          </div>
        </Card>
      ) : circles.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text">No circles yet</h3>
            <p className="max-w-md text-sm text-text-muted">
              Create your first circle to share photos, plan double dates, and
              stay connected with other couples — or join one with an invite
              code.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Create circle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJoin(true)}
              >
                <KeyRound className="h-4 w-4" />
                Join with code
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} />
          ))}
        </div>
      )}
    </div>
  );
}
