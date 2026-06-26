// Follow Requests — for a private-circle owner (mobile port of
// apps/web/src/app/(dashboard)/circles/requests/page.tsx). Lists pending incoming
// follow requests as rows with Accept / Decline (optimistic removal). New
// requests arrive in real time via `follow:request` and are prepended.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Check, Heart, Lock, UserCheck, X } from 'lucide-react-native';
import { Screen, Avatar, AppText, Button, Card, EmptyState, Spinner, Row, Skeleton, Badge } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { resolveMediaUrl } from '@/lib/env';
import * as circlesApi from '@/lib/circles-api';
import type { CircleSummary, FollowRequest } from '@/components/circles';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import { timeAgo, errMessage } from '@/components/circles/helpers';

interface FollowRequestEvent {
  followId: string;
  followerCircle: CircleSummary;
  pendingRequestCount?: number;
}

export default function CircleRequestsScreen() {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const LIST_WIDTH = 680;
  const couple = useAuthStore((s) => s.couple);

  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'accept' | 'decline'>>({});
  const [refreshing, setRefreshing] = useState(false);

  const seenRef = useRef<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { requests: list } = await circlesApi.getRequests();
      seenRef.current = new Set(list.map((r) => r.followId));
      setRequests(list);
      setError(null);
    } catch (err) {
      setError(errMessage(err, 'Could not load your follow requests. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchRequests();
    } finally {
      setRefreshing(false);
    }
  }, [fetchRequests]);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    fetchRequests();
  }, [couple?.isPaired, fetchRequests]);

  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onRequest = (payload: FollowRequestEvent) => {
      if (!payload?.followId || !payload.followerCircle) return;
      if (seenRef.current.has(payload.followId)) return;
      seenRef.current.add(payload.followId);
      setRequests((prev) => [
        { followId: payload.followId, circle: payload.followerCircle, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    };
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
      const snapshot = requests;
      removeRequest(req.followId);
      try {
        await circlesApi.acceptRequest(req.followId);
      } catch (err) {
        setRequests(snapshot);
        seenRef.current.add(req.followId);
        setError(errMessage(err, 'Could not accept that request. Please try again.'));
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
        setError(errMessage(err, 'Could not decline that request. Please try again.'));
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

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Follow requests" />
        <EmptyState
          icon={<Heart color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Follow requests are part of your couple's circle. Pair with your partner to start sharing."
        />
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: 6, paddingBottom: 12 }}>
      <Row gap={8}>
        <AppText variant="display">Follow requests</AppText>
        {requests.length > 0 ? <Badge label={requests.length} /> : null}
      </Row>
      <Row gap={6}>
        <Lock size={14} color={colors.textMuted} />
        <AppText muted>Couples waiting to follow your private circle</AppText>
      </Row>
      {error ? (
        <Card variant="bordered" style={{ marginTop: 8 }}>
          <AppText color={colors.error}>{error}</AppText>
        </Card>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <View style={{ gap: 10 }}>
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} height={72} radius={12} />
      ))}
    </View>
  ) : (
    <EmptyState
      icon={<UserCheck color={colors.textMuted} size={40} />}
      title="All caught up"
      subtitle="You have no pending follow requests right now. New requests will appear here the moment they arrive."
    />
  );

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? LIST_WIDTH : undefined, alignSelf: 'center' }}>
        <ScreenHeader title="Follow requests" />
      </View>
      <FlatList
        data={requests}
        keyExtractor={(r) => r.followId}
        contentContainerStyle={{
          padding: 16,
          gap: 8,
          width: '100%',
          maxWidth: isTablet ? LIST_WIDTH : undefined,
          alignSelf: 'center',
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        renderItem={({ item: req }) => {
          const { circle } = req;
          const displayHandle = circle.handle ? `@${circle.handle}` : null;
          const state = busy[req.followId];
          return (
            <Card variant="bordered" padded={false} style={{ padding: 12 }}>
              <Row gap={12} style={{ alignItems: 'center' }}>
                <Pressable
                  onPress={() => router.push(`/circles/${encodeURIComponent(circle.handle ?? circle.id)}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
                >
                  <Avatar uri={resolveMediaUrl(circle.avatarUrl)} name={circle.name} size={48} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="subtitle" numberOfLines={1}>{circle.name}</AppText>
                    {displayHandle ? (
                      <AppText variant="caption" muted numberOfLines={1}>{displayHandle}</AppText>
                    ) : null}
                    <AppText variant="caption" muted style={{ marginTop: 2 }}>{timeAgo(req.createdAt)}</AppText>
                  </View>
                </Pressable>

                <Row gap={8}>
                  <Button
                    size="sm"
                    variant="primary"
                    onPress={() => handleAccept(req)}
                    disabled={!!state}
                    loading={state === 'accept'}
                    leftIcon={<Check size={16} color={colors.textOnPrimary} />}
                    label="Accept"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => handleDecline(req)}
                    disabled={!!state}
                    loading={state === 'decline'}
                    leftIcon={<X size={16} color={colors.text} />}
                    label="Decline"
                  />
                </Row>
              </Row>
            </Card>
          );
        }}
      />
    </Screen>
  );
}
