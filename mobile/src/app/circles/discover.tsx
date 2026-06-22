// Circles › Discover — find couple circles to follow (mobile port of
// apps/web/src/app/(dashboard)/circles/discover/page.tsx). A debounced search bar
// queries GET /circles/discover?q=…; an empty query surfaces suggested PUBLIC
// circles. Each result is a CircleCard with an embedded FollowButton. Realtime
// follow:accepted / follow:removed keep follow states in sync.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Compass, Search, Heart, Sparkles, UserPlus } from 'lucide-react-native';
import { Screen, AppText, Button, Card, EmptyState, Spinner, Row, Skeleton } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import { CircleCard, type CircleProfile, type FollowState } from '@/components/circles';

export default function DiscoverScreen() {
  const { colors, radius } = useTheme();
  const { isTablet } = useResponsive();
  const LIST_WIDTH = 680;
  const couple = useAuthStore((s) => s.couple);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [circles, setCircles] = useState<CircleProfile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOwnCircle, setHasOwnCircle] = useState<boolean | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!couple?.isPaired) return;
    let cancelled = false;
    circlesApi
      .getMyCircle()
      .then((me) => {
        if (!cancelled) setHasOwnCircle(!!me.circle);
      })
      .catch(() => {
        if (!cancelled) setHasOwnCircle(true);
      });
    return () => {
      cancelled = true;
    };
  }, [couple?.isPaired]);

  const fetchResults = useCallback(async (q: string) => {
    const rid = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { circles: results, nextCursor: cursor } = await circlesApi.discover(q ? { q } : undefined);
      if (rid !== requestIdRef.current) return;
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
      // Swallow.
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, debouncedQuery]);

  const handleFollowChange = useCallback((id: string, state: FollowState) => {
    setCircles((prev) => prev.map((c) => (c.id === id ? { ...c, followState: state } : c)));
  }, []);

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
        prev.map((c) => (c.id === key || c.handle === key ? { ...c, followState: 'accepted' } : c)),
      );
    };
    const onRemoved = (payload: { circle?: { id?: string; handle?: string | null } }) => {
      const key = matchId(payload);
      if (!key) return;
      setCircles((prev) =>
        prev.map((c) => (c.id === key || c.handle === key ? { ...c, followState: 'none' } : c)),
      );
    };
    socket.on('follow:accepted', onAccepted);
    socket.on('follow:removed', onRemoved);
    return () => {
      socket.off('follow:accepted', onAccepted);
      socket.off('follow:removed', onRemoved);
    };
  }, [couple?.isPaired]);

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Discover" />
        <EmptyState
          icon={<Heart color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Discover other couples to follow once you and your partner are paired. Pair up to start exploring circles."
        />
      </Screen>
    );
  }

  const isSearching = debouncedQuery.length > 0;

  const header = (
    <View style={{ gap: 16, paddingBottom: 8 }}>
      <View>
        <AppText variant="caption" muted weight="700" style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}>
          Couple Circles
        </AppText>
        <Row gap={8}>
          <Compass size={24} color={colors.primary} />
          <AppText variant="display">Discover</AppText>
        </Row>
        <AppText muted>Find other couples to follow and add to your feed</AppText>
      </View>

      {/* Search */}
      <View style={{ justifyContent: 'center' }}>
        <Search size={18} color={colors.textMuted} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by handle, name, or bio…"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            backgroundColor: colors.surfaceHover,
            borderRadius: radius.input,
            paddingLeft: 42,
            paddingRight: 14,
            paddingVertical: 14,
            fontSize: 15,
            color: colors.text,
          }}
        />
      </View>

      {hasOwnCircle === false ? (
        <Card variant="bordered">
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <View>
                <AppText variant="label">Create your circle to start following</AppText>
                <AppText variant="caption" muted>
                  You need your own couple circle before you can follow others.
                </AppText>
              </View>
              <Button size="sm" onPress={() => router.push('/circles')} label="Create circle" />
            </View>
          </Row>
        </Card>
      ) : null}

      {!loading && !error && circles.length > 0 ? (
        <Row gap={6}>
          {isSearching ? null : <Sparkles size={14} color={colors.primary} />}
          <AppText variant="caption" muted weight="700" style={{ letterSpacing: 1, textTransform: 'uppercase' }}>
            {isSearching ? 'Results' : 'Suggested for you'}
          </AppText>
        </Row>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <View style={{ gap: 10 }}>
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} height={72} radius={12} />
      ))}
    </View>
  ) : error ? (
    <Card variant="bordered">
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
        <AppText color={colors.error} center>{error}</AppText>
        <Button variant="outline" size="sm" onPress={() => fetchResults(debouncedQuery)} label="Retry" />
      </View>
    </Card>
  ) : (
    <EmptyState
      icon={<Compass color={colors.primary} size={40} />}
      title={isSearching ? 'No circles found' : 'Nothing to discover yet'}
      subtitle={
        isSearching
          ? `We couldn't find any circles matching "${debouncedQuery}". Try a different handle or name.`
          : 'There are no public circles to suggest right now. Check back soon as more couples join.'
      }
    />
  );

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? LIST_WIDTH : undefined, alignSelf: 'center' }}>
        <ScreenHeader title="Discover" />
      </View>
      <FlatList
        data={circles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{
          padding: 16,
          gap: 10,
          width: '100%',
          maxWidth: isTablet ? LIST_WIDTH : undefined,
          alignSelf: 'center',
        }}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <CircleCard circle={item} onFollowChange={handleFollowChange} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Spinner size="small" />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}
