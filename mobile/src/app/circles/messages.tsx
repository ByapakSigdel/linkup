// Circles DM INBOX — list of the caller's circle's conversations
// (mobile port of the web inbox; mirrors the intra-couple chat list UX, but for
// couple-to-couple circle conversations). Each row shows the OTHER circle's
// avatar + name, a last-message preview, relative time, and an unread badge.
// Tap → the thread. Pull-to-refresh + empty state. Realtime: circle:dm:new
// (bump/refresh) + circle:dm:read (clear own unread) keep the list fresh.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, RefreshControl, Pressable } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import {
  Screen,
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Row,
  Skeleton,
  Spinner,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { getSocket } from '@/lib/socket';
import { resolveMediaUrl } from '@/lib/env';
import * as circlesApi from '@/lib/circles-api';
import { timeAgo, errMessage } from '@/components/circles/helpers';
import type { CircleConversation, CircleDmMessage } from '@/components/circles/types';

const INBOX_WIDTH = 680;

export default function CircleMessagesScreen() {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<CircleConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  // My own circle id — needed so the circle:dm:read handler can tell MY read
  // (clear my badge) apart from the OTHER circle's read (the gateway fans the
  // event to all participants, including the reader's couple). Held in a ref so
  // the stable socket handler always sees the resolved value.
  const myCircleIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { conversations: list, nextCursor: cursor } = await circlesApi.getConversations();
      setConversations(list);
      setNextCursor(cursor);
    } catch (err) {
      setError(errMessage(err, 'Could not load your messages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    void load();
    // Resolve my own circle id once so the read handler can scope to MY reads.
    circlesApi
      .getMyCircle()
      .then((res) => {
        myCircleIdRef.current = res.circle?.id ?? null;
      })
      .catch(() => {
        // Non-fatal: without it the read handler conservatively skips clearing.
      });
  }, [couple?.isPaired, load]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { conversations: more, nextCursor: cur } = await circlesApi.getConversations({
        cursor: nextCursor,
      });
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(cur);
    } catch {
      // Non-fatal.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Realtime: keep the inbox fresh when a message arrives or a thread is read
  // elsewhere. Stable handlers; unsubscribe on unmount.
  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onNew = (payload: { conversationId: string; message: CircleDmMessage }) => {
      if (!payload?.message) return;
      const me = user?.id;
      const incoming = !!me && payload.message.senderUserId !== me;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) {
          // A conversation we haven't loaded yet — refetch the inbox to pull it in.
          void load();
          return prev;
        }
        const existing = prev[idx]!;
        const preview = (payload.message.content || '').trim()
          ? payload.message.content!.trim()
          : payload.message.mediaUrls.length
            ? '📷 Photo'
            : existing.lastMessagePreview;
        const updated: CircleConversation = {
          ...existing,
          lastMessagePreview: preview ?? existing.lastMessagePreview,
          lastMessageAt: payload.message.createdAt ?? existing.lastMessageAt,
          unreadCount: incoming ? existing.unreadCount + 1 : existing.unreadCount,
        };
        // Move the touched conversation to the top.
        const rest = prev.filter((_, i) => i !== idx);
        return [updated, ...rest];
      });
    };

    const onRead = (payload: { conversationId: string; circleId: string }) => {
      // The gateway fans circle:dm:read to ALL participants (both circles), so
      // only clear the badge when it's MY circle's read marker that advanced
      // (e.g. the thread was read on another device). Ignore the OTHER circle
      // reading the thread — that must not zero my own unread count.
      const mine = myCircleIdRef.current;
      if (!mine || payload.circleId !== mine) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === payload.conversationId ? { ...c, unreadCount: 0 } : c,
        ),
      );
    };

    socket.on('circle:dm:new', onNew);
    socket.on('circle:dm:read', onRead);
    return () => {
      socket.off('circle:dm:new', onNew);
      socket.off('circle:dm:read', onRead);
    };
  }, [couple?.isPaired, user?.id, load]);

  const openThread = useCallback((conv: CircleConversation) => {
    router.push(`/circles/messages/${conv.id}`);
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: CircleConversation }) => {
      const other = item.otherCircle;
      const name = other ? (other.handle ? `@${other.handle}` : other.name) : 'Circle';
      const hasUnread = item.unreadCount > 0;
      return (
        <Pressable
          onPress={() => openThread(item)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.7 : 1,
            paddingHorizontal: 16,
            paddingVertical: 12,
          })}
          accessibilityRole="button"
          accessibilityLabel={`Open conversation with ${name}`}
        >
          <Row gap={12} style={{ alignItems: 'center' }}>
            <Avatar uri={resolveMediaUrl(other?.avatarUrl)} name={other?.name} size={52} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Row gap={8} style={{ justifyContent: 'space-between' }}>
                <AppText
                  variant="label"
                  weight={hasUnread ? '700' : '600'}
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {name}
                </AppText>
                {item.lastMessageAt ? (
                  <AppText variant="caption" muted>
                    {timeAgo(item.lastMessageAt)}
                  </AppText>
                ) : null}
              </Row>
              <Row gap={8} style={{ justifyContent: 'space-between' }}>
                <AppText
                  variant="caption"
                  muted={!hasUnread}
                  color={hasUnread ? colors.text : undefined}
                  weight={hasUnread ? '600' : undefined}
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {item.lastMessagePreview || 'Say hello 👋'}
                </AppText>
                {hasUnread ? (
                  <Badge label={item.unreadCount > 99 ? '99+' : item.unreadCount} />
                ) : null}
              </Row>
            </View>
          </Row>
        </Pressable>
      );
    },
    [colors.text, openThread],
  );

  // ─── Not paired ──────────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Messages" />
        <EmptyState
          icon={<MessageCircle color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Circle messages are between two couples. Pair with your partner to start a conversation."
        />
      </Screen>
    );
  }

  const listHeaderWrap = (
    <View
      style={{
        paddingHorizontal: 16,
        width: '100%',
        maxWidth: isTablet ? INBOX_WIDTH : undefined,
        alignSelf: 'center',
      }}
    >
      <ScreenHeader title="Messages" />
    </View>
  );

  if (loading) {
    return (
      <Screen padded={false}>
        {listHeaderWrap}
        <View style={{ paddingTop: 8 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Row key={i} gap={12} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <Skeleton width={52} height={52} radius={26} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width={140} height={14} />
                <Skeleton width={200} height={12} />
              </View>
            </Row>
          ))}
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen padded={false}>
        {listHeaderWrap}
        <View style={{ padding: 16 }}>
          <Card variant="bordered">
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
              <AppText color={colors.error} center>{error}</AppText>
              <Button variant="outline" size="sm" onPress={load} label="Retry" />
            </View>
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      {listHeaderWrap}
      <FlatList
        data={conversations}
        keyExtractor={(c) => c.id}
        renderItem={renderRow}
        contentContainerStyle={{
          paddingBottom: 24,
          width: '100%',
          maxWidth: isTablet ? INBOX_WIDTH : undefined,
          alignSelf: 'center',
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 80 }} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<MessageCircle color={colors.primary} size={40} />}
            title="No messages yet"
            subtitle="Message a couple you mutually follow from their profile to start a conversation here."
          />
        }
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
    </Screen>
  );
}
