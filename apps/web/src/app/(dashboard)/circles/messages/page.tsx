'use client';

// Circles DM INBOX (web) — the caller's circle's couple-to-couple conversations.
// Web parity for mobile circles/messages.tsx + the existing chat list UX. Each
// row shows the OTHER circle's avatar + name, a last-message preview, relative
// time, and an unread badge. Click → the thread. Infinite scroll + empty state.
//
// Realtime (shared socket, cleaned up on unmount):
//   circle:dm:new  — bump/move the touched conversation to the top.
//   circle:dm:read — clear our own unread badge for that conversation.
// The in-screen state here is separate from the global useCircleDmStore badge
// (which the RealtimeProvider keeps fresh app-wide); both stay in sync.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Avatar, Button, Card, Spinner } from '@/components/ui';
import {
  type CircleConversation,
  type CircleDmMessage,
} from '@/components/circles';
import { errMessage, timeAgo } from '@/components/circles/dm-helpers';
import { useAuthStore } from '@/stores/auth-store';
import { useCircleDmStore } from '@/stores/circle-dm-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';

export default function CircleMessagesPage() {
  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<CircleConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<string | null>(null);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { conversations: list, nextCursor: cursor } =
        await circlesApi.getConversations();
      setConversations(list);
      setNextCursor(cursor);
      cursorRef.current = cursor;
      // Seed the global unread badge from the authoritative inbox.
      useCircleDmStore.getState().setFromInbox(list);
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
  }, [couple?.isPaired, load]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const cursor = cursorRef.current;
    if (!cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { conversations: more, nextCursor: cur } =
        await circlesApi.getConversations({ cursor });
      setConversations((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...more.filter((c) => !seen.has(c.id))];
      });
      setNextCursor(cur);
      cursorRef.current = cur;
    } catch {
      // Non-fatal.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // Infinite scroll via an IntersectionObserver on the sentinel (matches feed).
  useEffect(() => {
    if (!couple?.isPaired) return;
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
  }, [couple?.isPaired, loadMore, nextCursor]);

  // Realtime: keep the inbox list fresh on inbound messages / reads.
  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const onNew = (payload: {
      conversationId: string;
      message: CircleDmMessage;
    }) => {
      if (!payload?.message) return;
      const me = user?.id;
      const incoming = !!me && payload.message.senderUserId !== me;
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === payload.conversationId);
        if (idx === -1) {
          // A conversation we haven't loaded yet — refetch to pull it in.
          void load();
          return prev;
        }
        const existing = prev[idx]!;
        const text = (payload.message.content || '').trim();
        const preview = text
          ? text
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
      // A `circle:dm:read` fans out to ALL participants (both couples). Only OUR
      // circle's read clears the row badge — the OTHER couple reading must not
      // zero it. Mirror the RealtimeProvider's ownership guard.
      const myCircleId = useCircleDmStore.getState().myCircleId;
      if (myCircleId && payload.circleId !== myCircleId) return;
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

  // ─── Not paired ──────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
        <Header />
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
              <MessageCircle className="h-7 w-7" />
            </span>
            <h2 className="text-lg font-semibold text-text">
              Link up with your partner first
            </h2>
            <p className="max-w-sm text-sm text-text-muted">
              Circle messages are between two couples. Pair with your partner to
              start a conversation.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-6">
      <Header />

      {loading ? (
        <div className="space-y-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <span className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-surface-active" />
              <div className="flex-1 space-y-2">
                <span className="block h-3.5 w-40 animate-pulse rounded bg-surface-active" />
                <span className="block h-3 w-56 animate-pulse rounded bg-surface-active" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-error">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        </Card>
      ) : conversations.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
              <MessageCircle className="h-7 w-7" />
            </span>
            <h3 className="text-lg font-semibold text-text">No messages yet</h3>
            <p className="max-w-sm text-sm text-text-muted">
              Message a couple you mutually follow from their profile to start a
              conversation here.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <ConversationRow conversation={conv} />
            </li>
          ))}
        </ul>
      )}

      {/* Infinite-scroll sentinel + loader. */}
      <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-3">
      <Link
        href="/circles"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to circles
      </Link>
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Circles
        </p>
        <h1 className="font-display text-2xl font-bold text-text">Messages</h1>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
}: {
  conversation: CircleConversation;
}) {
  const other = conversation.otherCircle;
  const name = other ? (other.handle ? `@${other.handle}` : other.name) : 'Circle';
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Link
      href={`/circles/messages/${conversation.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
    >
      <Avatar src={other?.avatarUrl} name={other?.name} size="lg" alt={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span
            className={cnName(hasUnread)}
            title={name}
          >
            {name}
          </span>
          {conversation.lastMessageAt && (
            <span className="shrink-0 text-xs text-text-muted">
              {timeAgo(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span
            className={
              hasUnread
                ? 'truncate text-sm font-medium text-text'
                : 'truncate text-sm text-text-muted'
            }
          >
            {conversation.lastMessagePreview || 'Say hello 👋'}
          </span>
          {hasUnread && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-bold text-text-on-primary">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function cnName(hasUnread: boolean): string {
  return hasUnread
    ? 'truncate font-display text-sm font-bold text-text'
    : 'truncate font-display text-sm font-semibold text-text';
}
