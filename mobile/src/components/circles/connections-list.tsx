// ConnectionsList — owner-only paginated list of the caller's circle followers
// or following (§1.6). Consumes GET /circles/me/followers and
// /circles/me/following via the circles API. Rendered by the
// circles/[id]/followers and following screens.
//
// Each row is a CircleCard (avatar, @handle, embedded FollowButton). Infinite
// scroll via onEndReached + pull-to-refresh, matching the discover list pattern.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { Users } from 'lucide-react-native';
import { AppText, Button, Card, EmptyState, Spinner, Skeleton } from '@/components/ui';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import * as circlesApi from '@/lib/circles-api';
import { CircleCard } from './circle-card';
import { errMessage } from './helpers';
import type { CircleSummary, FollowState } from './types';

export type ConnectionsKind = 'followers' | 'following';

interface ConnectionsListProps {
  kind: ConnectionsKind;
}

export function ConnectionsList({ kind }: ConnectionsListProps) {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const LIST_WIDTH = 680;

  const [items, setItems] = useState<CircleSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMoreRef = useRef(false);

  // Normalize the followers/following responses into a common shape so the rest
  // of the component is kind-agnostic.
  const fetchPage = useCallback(
    async (cursor?: string): Promise<{ list: CircleSummary[]; nextCursor: string | null }> => {
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
    } catch (err) {
      setError(errMessage(err, 'Could not load this list. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { list: more, nextCursor: cursor } = await fetchPage(nextCursor);
      setItems((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(cursor);
    } catch {
      // Non-fatal.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [fetchPage, nextCursor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleFollowChange = useCallback((id: string, state: FollowState) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, followState: state } : c)));
  }, []);

  const empty = loading ? (
    <View style={{ gap: 10 }}>
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} height={72} radius={12} />
      ))}
    </View>
  ) : error ? (
    <Card variant="bordered">
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
        <AppText color={colors.error} center>{error}</AppText>
        <Button variant="outline" size="sm" onPress={() => void load()} label="Retry" />
      </View>
    </Card>
  ) : (
    <EmptyState
      icon={<Users color={colors.textMuted} size={40} />}
      title={kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
      subtitle={
        kind === 'followers'
          ? 'When other couples follow your circle, they will appear here.'
          : 'Circles your couple follows will appear here. Discover couples to start following.'
      }
    />
  );

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{
        padding: 16,
        gap: 10,
        width: '100%',
        maxWidth: isTablet ? LIST_WIDTH : undefined,
        alignSelf: 'center',
      }}
      ListEmptyComponent={empty}
      renderItem={({ item }) => <CircleCard circle={item} onFollowChange={handleFollowChange} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Spinner size="small" />
          </View>
        ) : null
      }
    />
  );
}
