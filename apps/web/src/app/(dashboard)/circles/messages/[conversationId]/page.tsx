'use client';

// Circles DM THREAD (web) — a couple-to-couple conversation view. Web parity for
// mobile circles/messages/[conversationId].tsx + the existing chat thread UX.
// Messages fan out to up to 4 participants, so own-vs-other is decided by
// senderUserId vs the current user (not the couple). Read receipts use
// senderCircleId so "Read" flips only when the OTHER couple reads.
//
// Realtime (shared socket; STABLE handlers via refs; cleaned up on unmount):
//   circle:dm:new    — append an incoming/echoed message.
//   circle:dm:read   — the OTHER circle read → flip our sent ticks to "Read".
//   circle:dm:typing — the OTHER circle is typing.
// Marks the thread read on open (and when a message arrives while open).

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ImagePlus, Loader2, MessageCircle, Send } from 'lucide-react';
import { Avatar, Spinner } from '@/components/ui';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import {
  type CircleConversation,
  type CircleDmMessage,
  type CircleSummary,
} from '@/components/circles';
import {
  errMessage,
  formatTime,
  getDateLabel,
  isVideoUrl,
} from '@/components/circles/dm-helpers';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useCircleDmStore } from '@/stores/circle-dm-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';

const PAGE_LIMIT = 30;
const MAX_CHARS = 4000;

// A chronological row with grouping/date metadata for rendering.
interface Row {
  message: CircleDmMessage;
  showDate: boolean;
  grouped: boolean;
  dateLabel: string;
}

export default function CircleThreadPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params?.conversationId ?? '';

  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);
  const myUserId = user?.id;
  const coupleId = couple?.id ?? null;
  const pushToast = useToastStore((s) => s.push);

  const [messages, setMessages] = useState<CircleDmMessage[]>([]);
  const [other, setOther] = useState<CircleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  // The OTHER circle's lastReadAt — used to flip our sent messages to "Read".
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadingMoreRef = useRef(false);
  const nextCursorRef = useRef<string | null>(null);
  nextCursorRef.current = nextCursor;

  // Refs so realtime + typing handlers stay stable but see fresh values.
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  const otherCircleIdRef = useRef<string | null>(other?.id ?? null);
  otherCircleIdRef.current = other?.id ?? null;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pin the scroll to the bottom on the next render after a send/receive.
  const stickToBottomRef = useRef(true);

  // ─── Load initial page (+ resolve the other circle from the inbox) ──────────
  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const { messages: list, nextCursor: cur } = await circlesApi.getMessages(
        conversationId,
        { limit: PAGE_LIMIT },
      );
      // API returns newest-first; store chronological (oldest-first).
      setMessages([...list].reverse());
      setNextCursor(cur);
      stickToBottomRef.current = true;
    } catch (err) {
      setError(errMessage(err, 'Could not load this conversation.'));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const loadHeader = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { conversations } = await circlesApi.getConversations({ limit: 50 });
      const match = conversations.find(
        (c: CircleConversation) => c.id === conversationId,
      );
      if (match?.otherCircle) setOther(match.otherCircle);
    } catch {
      // Header falls back to a generic title.
    }
  }, [conversationId]);

  useEffect(() => {
    if (!couple?.isPaired) {
      setLoading(false);
      return;
    }
    void load();
    void loadHeader();
  }, [couple?.isPaired, load, loadHeader]);

  // Mark the thread read on open (and clear the global badge for it).
  const markRead = useCallback(() => {
    if (!conversationId) return;
    circlesApi.markRead(conversationId).catch(() => {});
    useCircleDmStore.getState().clear(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (!loading && !error) markRead();
  }, [loading, error, markRead]);

  // ─── Pagination (older messages) ────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursorRef.current || !conversationId)
      return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    try {
      const { messages: older, nextCursor: cur } = await circlesApi.getMessages(
        conversationId,
        { cursor: nextCursorRef.current, limit: PAGE_LIMIT },
      );
      stickToBottomRef.current = false;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = [...older].reverse().filter((m) => !seen.has(m.id));
        return [...add, ...prev];
      });
      setNextCursor(cur);
      // Preserve scroll position after prepending older messages.
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevHeight;
        }
      });
    } catch {
      // Non-fatal.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [conversationId]);

  // Load older when the user scrolls near the top.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 120) void loadOlder();
  }, [loadOlder]);

  // Keep pinned to the bottom after sends/receives (not after loading older).
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // ─── Realtime ────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (payload: {
      conversationId: string;
      message: CircleDmMessage;
    }) => {
      if (payload?.conversationId !== conversationIdRef.current || !payload.message)
        return;
      stickToBottomRef.current = true;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      // An incoming message while the thread is open → mark read immediately.
      if (payload.message.senderUserId !== myUserIdRef.current) {
        const cid = conversationIdRef.current;
        if (cid) {
          circlesApi.markRead(cid).catch(() => {});
          useCircleDmStore.getState().clear(cid);
        }
      }
    };

    const onRead = (payload: {
      conversationId: string;
      circleId: string;
      lastReadAt: string;
    }) => {
      if (payload?.conversationId !== conversationIdRef.current) return;
      // Only the OTHER circle reading flips our sent ticks to "Read". Our own
      // read receipts (fanned to all participants) must be ignored.
      const otherId = otherCircleIdRef.current;
      if (otherId && payload.circleId !== otherId) return;
      setOtherLastReadAt((prev) =>
        !prev || new Date(payload.lastReadAt) > new Date(prev)
          ? payload.lastReadAt
          : prev,
      );
    };

    const onTyping = (payload: {
      conversationId: string;
      userId: string;
      isTyping?: boolean;
    }) => {
      if (payload?.conversationId !== conversationIdRef.current) return;
      if (payload.userId === myUserIdRef.current) return;
      if (typingClearRef.current) {
        clearTimeout(typingClearRef.current);
        typingClearRef.current = null;
      }
      const typing = payload.isTyping ?? true;
      setOtherTyping(typing);
      if (typing) {
        // Safety auto-clear if a stop is dropped.
        typingClearRef.current = setTimeout(() => setOtherTyping(false), 6000);
      }
    };

    socket.on('circle:dm:new', onNew);
    socket.on('circle:dm:read', onRead);
    socket.on('circle:dm:typing', onTyping);
    return () => {
      socket.off('circle:dm:new', onNew);
      socket.off('circle:dm:read', onRead);
      socket.off('circle:dm:typing', onTyping);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
    };
  }, []);

  // ─── Typing emit ────────────────────────────────────────────────────────────
  const emitTyping = useCallback((isTyping: boolean) => {
    const socket = getSocket();
    const cid = conversationIdRef.current;
    if (!socket?.connected || !cid) return;
    socket.emit('circle:dm:typing', { conversationId: cid, isTyping });
  }, []);

  const handleTypingActivity = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emitTyping(false);
    }, 2000);
  }, [emitTyping]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emitTyping(false);
    }
  }, [emitTyping]);

  useEffect(
    () => () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      if (text.length > MAX_CHARS) return;
      setValue(text);
      if (text.length > 0) handleTypingActivity();
    },
    [handleTypingActivity],
  );

  // ─── Send (text) ────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || !conversationId) return;
    setSending(true);
    stopTyping();
    try {
      const { message } = await circlesApi.sendMessage(conversationId, {
        content: trimmed,
      });
      setValue('');
      stickToBottomRef.current = true;
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message],
      );
    } catch (err) {
      pushToast({
        title: 'Could not send',
        body: errMessage(err, 'Please try again.'),
      });
    } finally {
      setSending(false);
    }
  }, [value, sending, conversationId, stopTyping, pushToast]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  // ─── Attach (image) ──────────────────────────────────────────────────────────
  const handleAttachClick = useCallback(() => {
    if (attaching || sending) return;
    fileInputRef.current?.click();
  }, [attaching, sending]);

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // allow re-selecting the same file
      if (!file || !conversationId) return;
      if (!file.type.startsWith('image/')) {
        pushToast({ title: 'Unsupported file', body: 'Please choose an image.' });
        return;
      }
      if (!coupleId) {
        pushToast({
          title: 'Could not share image',
          body: 'We could not find your couple. Please reload.',
        });
        return;
      }
      setAttaching(true);
      try {
        const uploaded = await circlesApi.uploadMedia(file, coupleId);
        const url = uploaded.media?.cdnUrl;
        if (!url) throw new Error('No URL returned');
        const { message } = await circlesApi.sendMessage(conversationId, {
          content: value.trim() || undefined,
          mediaUrls: [url],
        });
        setValue('');
        stickToBottomRef.current = true;
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message],
        );
      } catch (err) {
        pushToast({
          title: 'Upload failed',
          body: errMessage(err, 'Could not share that image.'),
        });
      } finally {
        setAttaching(false);
      }
    },
    [conversationId, coupleId, value, pushToast],
  );

  // ─── Rows (chronological grouping + date separators) ────────────────────────
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;
      const prev = i > 0 ? messages[i - 1] : undefined;
      const currDate = message.createdAt
        ? new Date(message.createdAt).toDateString()
        : '';
      const prevDate = prev?.createdAt
        ? new Date(prev.createdAt).toDateString()
        : '';
      const showDate = !prev || currDate !== prevDate;
      const sameSender = !!prev && prev.senderUserId === message.senderUserId;
      const closeInTime =
        !!prev &&
        !!prev.createdAt &&
        !!message.createdAt &&
        new Date(message.createdAt).getTime() -
          new Date(prev.createdAt).getTime() <
          60000;
      out.push({
        message,
        showDate,
        grouped: sameSender && closeInTime && !showDate,
        dateLabel:
          showDate && message.createdAt ? getDateLabel(message.createdAt) : '',
      });
    }
    return out;
  }, [messages]);

  // The id of my most recent message that the other side has read.
  const lastReadMineId = useMemo(() => {
    if (!otherLastReadAt || !myUserId) return null;
    const readTs = new Date(otherLastReadAt).getTime();
    let id: string | null = null;
    for (const m of messages) {
      if (
        m.senderUserId === myUserId &&
        m.createdAt &&
        new Date(m.createdAt).getTime() <= readTs
      ) {
        id = m.id;
      }
    }
    return id;
  }, [otherLastReadAt, myUserId, messages]);

  const headerName = other
    ? other.handle
      ? `@${other.handle}`
      : other.name
    : 'Conversation';
  const profileHref = other
    ? `/circles/${encodeURIComponent(other.handle ?? other.id)}`
    : undefined;

  const hasText = value.trim().length > 0;

  // ─── Not paired ──────────────────────────────────────────────────────────
  if (!couple?.isPaired) {
    return (
      <div className="mx-auto max-w-2xl p-4 md:p-6">
        <ThreadEmpty
          title="Link up with your partner first"
          subtitle="Circle messages are between two couples."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Link
          href="/circles/messages"
          aria-label="Back to messages"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {profileHref ? (
          <Link
            href={profileHref}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-surface-hover"
          >
            <Avatar src={other?.avatarUrl} name={other?.name} size="sm" alt={headerName} />
            <span className="truncate font-display text-base font-semibold text-text">
              {headerName}
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-1 py-1">
            <Avatar src={other?.avatarUrl} name={other?.name} size="sm" alt={headerName} />
            <span className="truncate font-display text-base font-semibold text-text">
              {headerName}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loadingMore && (
          <div className="flex justify-center pb-3">
            <Spinner size="sm" />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={cn('flex', i % 2 ? 'justify-end' : 'justify-start')}
              >
                <span
                  className="block h-10 animate-pulse rounded-2xl bg-surface-active"
                  style={{ width: 140 + (i % 3) * 50 }}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          <ThreadEmpty title="Couldn't load" subtitle={error} isError />
        ) : messages.length === 0 ? (
          <ThreadEmpty
            title="Start the conversation"
            subtitle={`Say hi to ${headerName}.`}
          />
        ) : (
          <div className="flex flex-col">
            {rows.map((row) => (
              <MessageRow
                key={row.message.id}
                row={row}
                isMine={row.message.senderUserId === myUserId}
                showRead={
                  row.message.senderUserId === myUserId &&
                  row.message.id === lastReadMineId
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {otherTyping && <TypingIndicator partnerName={headerName} />}

      {/* Composer */}
      <div className="flex items-end gap-2 border-t border-border bg-surface px-3 py-3">
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={attaching || sending}
          aria-label="Attach image"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
        >
          {attaching ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${headerName}…`}
          rows={1}
          disabled={sending}
          className={cn(
            'flex-1 resize-none rounded-[var(--lk-input-radius)] border border-border bg-background-alt px-4 py-2.5 text-sm leading-relaxed text-text placeholder:text-text-muted',
            'focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20 disabled:opacity-50',
          )}
          style={{ maxHeight: 140 }}
          aria-label={`Message ${headerName}`}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!hasText || sending}
          aria-label="Send message"
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
            hasText && !sending
              ? 'bg-primary text-text-on-primary hover:bg-primary-hover shadow-sm'
              : 'bg-surface-hover text-text-muted',
          )}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function MessageRow({
  row,
  isMine,
  showRead,
}: {
  row: Row;
  isMine: boolean;
  showRead: boolean;
}) {
  const { message } = row;
  const media = (message.mediaUrls || []).filter((u): u is string => !!u);

  return (
    <>
      {row.showDate && (
        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-text-muted">
            {row.dateLabel}
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      <div
        className={cn(
          'flex',
          isMine ? 'justify-end' : 'justify-start',
          row.grouped ? 'mt-0.5' : 'mt-2',
        )}
      >
        <div className="flex max-w-[78%] flex-col">
          {/* Other-circle sender label (a thread can have up to 4 people). */}
          {!isMine && !row.grouped && message.senderName && (
            <span className="mb-0.5 ml-1 text-xs font-semibold text-text-muted">
              {message.senderName}
            </span>
          )}

          <div
            className={cn(
              'px-3 py-2 text-sm leading-relaxed break-words',
              isMine
                ? 'bg-message-sent text-message-sent-text'
                : 'bg-message-received text-message-received-text',
            )}
            style={{
              borderRadius: isMine
                ? 'var(--chat-bubble-sent-radius)'
                : 'var(--chat-bubble-received-radius)',
              boxShadow: 'var(--chat-bubble-shadow)',
            }}
          >
            {media.length > 0 && (
              <div className={cn(message.content && 'mb-1.5', 'space-y-1.5')}>
                {media.map((url) =>
                  isVideoUrl(url) ? (
                    <video
                      key={url}
                      src={url}
                      controls
                      className="max-h-72 w-full max-w-xs rounded-xl bg-surface-active"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      loading="lazy"
                      className="max-h-72 w-full max-w-xs rounded-xl object-cover"
                    />
                  ),
                )}
              </div>
            )}

            {message.content && (
              <p className="whitespace-pre-wrap">{message.content}</p>
            )}

            {!row.grouped && (
              <div
                className={cn(
                  'mt-1 flex items-center gap-1',
                  isMine ? 'justify-end' : 'justify-start',
                )}
              >
                <span
                  className={cn(
                    'text-[10px]',
                    isMine ? 'text-text-on-primary/60' : 'text-text-muted',
                  )}
                >
                  {formatTime(message.createdAt)}
                </span>
              </div>
            )}
          </div>

          {showRead && (
            <span className="mr-1 mt-0.5 self-end text-[10px] font-semibold text-info">
              Read
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function ThreadEmpty({
  title,
  subtitle,
  isError = false,
}: {
  title: string;
  subtitle: string;
  isError?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full',
          isError ? 'bg-error/10 text-error' : 'bg-primary-light text-primary',
        )}
      >
        <MessageCircle className="h-7 w-7" />
      </span>
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <p className="max-w-xs text-sm text-text-muted">{subtitle}</p>
    </div>
  );
}
