// Circles DM THREAD — couple-to-couple conversation view. Mirrors the
// intra-couple chat thread UX (inverted keyset message list, composer with
// image attach, typing indicator, read receipts) but for circle conversations,
// where messages fan out to up to 4 participants and own-vs-other is decided by
// senderUserId vs the current user.
//
// Realtime (subscribed with STABLE handlers, unsubscribed on unmount):
//   circle:dm:new    — append an incoming/echoed message
//   circle:dm:read   — the OTHER circle read the thread → flip our sent ticks
//   circle:dm:typing — the OTHER circle is typing
// Marks the thread read on open (and when a new message arrives while open).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Plus, Send, MessageCircle } from 'lucide-react-native';
import { useTheme } from '@/theme';
import {
  AppText,
  Avatar,
  EmptyState,
  Spinner,
  Skeleton,
  Touchable,
} from '@/components/ui';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import { resolveMediaUrl } from '@/lib/env';
import * as circlesApi from '@/lib/circles-api';
import { errMessage, assetToUploadFile, isVideoUrl } from '@/components/circles/helpers';
import type { CircleDmMessage, CircleSummary } from '@/components/circles/types';

const THREAD_MAX_WIDTH = 760;
const PAGE_LIMIT = 30;

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}

// Row metadata computed in chronological order, then consumed by the inverted list.
interface Row {
  message: CircleDmMessage;
  showDate: boolean;
  grouped: boolean;
  dateLabel: string;
}

export default function CircleThreadScreen() {
  const { colors, radius } = useTheme();
  const { isWide } = useResponsive();
  const params = useLocalSearchParams<{ conversationId: string }>();
  const conversationId = params?.conversationId;
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);

  const [messages, setMessages] = useState<CircleDmMessage[]>([]);
  const [other, setOther] = useState<CircleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const [value, setValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  // The OTHER circle's lastReadAt — used to flip our sent messages to "Read".
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);

  const coupleId = useAuthStore((s) => s.couple?.id ?? null);
  const myUserId = user?.id;

  // Refs so realtime + typing handlers stay stable but see fresh values.
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  // The other circle's id — used to ignore our OWN read receipts (the gateway
  // fans circle:dm:read to all participants, including the reader's couple).
  const otherCircleIdRef = useRef<string | null>(other?.id ?? null);
  otherCircleIdRef.current = other?.id ?? null;
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load initial page (+ resolve the other circle from the inbox) ────────────
  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const { messages: list, nextCursor: cur } = await circlesApi.getMessages(conversationId, {
        limit: PAGE_LIMIT,
      });
      // API returns newest-first; store chronological (oldest-first).
      setMessages([...list].reverse());
      setNextCursor(cur);
    } catch (err) {
      setError(errMessage(err, 'Could not load this conversation.'));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  // Resolve the other circle's summary for the header via the dedicated
  // single-conversation endpoint (works for any thread, incl. deep-links to
  // older conversations not on the first inbox page).
  const loadHeader = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { conversation } = await circlesApi.getConversation(conversationId);
      if (conversation?.otherCircle) setOther(conversation.otherCircle);
    } catch {
      // Header falls back to a generic title.
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
    void loadHeader();
  }, [load, loadHeader]);

  // Mark the thread read on open.
  const markRead = useCallback(() => {
    if (!conversationId) return;
    circlesApi.markRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    if (!loading) markRead();
    // Mark read once the thread has loaded (and whenever the conversation changes).
  }, [loading, markRead]);

  // ─── Pagination (older messages) ──────────────────────────────────────────────
  const loadOlder = useCallback(async () => {
    if (loadingMoreRef.current || !nextCursor || !conversationId) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { messages: older, nextCursor: cur } = await circlesApi.getMessages(conversationId, {
        cursor: nextCursor,
        limit: PAGE_LIMIT,
      });
      // `older` is newest-first within the page; prepend chronologically.
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = [...older].reverse().filter((m) => !seen.has(m.id));
        return [...add, ...prev];
      });
      setNextCursor(cur);
    } catch {
      // Non-fatal.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [nextCursor, conversationId]);

  // ─── Realtime ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNew = (payload: { conversationId: string; message: CircleDmMessage }) => {
      if (payload?.conversationId !== conversationIdRef.current || !payload.message) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      // An incoming message while the thread is open → mark read immediately.
      if (payload.message.senderUserId !== myUserIdRef.current) {
        const cid = conversationIdRef.current;
        if (cid) circlesApi.markRead(cid).catch(() => {});
      }
    };

    const onRead = (payload: { conversationId: string; circleId: string; lastReadAt: string }) => {
      if (payload?.conversationId !== conversationIdRef.current) return;
      // Only the OTHER circle reading flips our sent ticks to "Read". Our own
      // read receipts (the gateway fans out to all participants) must be ignored,
      // or we'd mark our own messages "Read" the moment we open the thread.
      const otherId = otherCircleIdRef.current;
      if (otherId && payload.circleId !== otherId) return;
      setOtherLastReadAt((prev) =>
        !prev || new Date(payload.lastReadAt) > new Date(prev) ? payload.lastReadAt : prev,
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
    (text: string) => {
      setValue(text);
      if (text.length > 0) handleTypingActivity();
    },
    [handleTypingActivity],
  );

  // ─── Send (text) ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sending || !conversationId) return;
    setSending(true);
    stopTyping();
    try {
      const { message } = await circlesApi.sendMessage(conversationId, { content: trimmed });
      setValue('');
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch (err) {
      pushToast({ title: 'Could not send', body: errMessage(err, 'Please try again.') });
    } finally {
      setSending(false);
    }
  }, [value, sending, conversationId, stopTyping, pushToast]);

  // ─── Attach (image) ─────────────────────────────────────────────────────────
  const handleAttach = useCallback(async () => {
    if (!conversationId || !coupleId || attaching || sending) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      pushToast({ title: 'Permission needed', body: 'Allow photo access to share an image.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAttaching(true);
    try {
      const uploaded = await circlesApi.uploadMedia(assetToUploadFile(result.assets[0]), coupleId);
      const url = uploaded.media?.cdnUrl;
      if (!url) throw new Error('No URL returned');
      const { message } = await circlesApi.sendMessage(conversationId, {
        content: value.trim() || undefined,
        mediaUrls: [url],
      });
      setValue('');
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    } catch (err) {
      pushToast({ title: 'Upload failed', body: errMessage(err, 'Could not share that image.') });
    } finally {
      setAttaching(false);
    }
  }, [conversationId, coupleId, attaching, sending, value, pushToast]);

  // ─── Rows (chronological grouping, then reversed for the inverted list) ───────
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;
      const prev = i > 0 ? messages[i - 1] : undefined;
      const currDate = message.createdAt ? new Date(message.createdAt).toDateString() : '';
      const prevDate = prev?.createdAt ? new Date(prev.createdAt).toDateString() : '';
      const showDate = !prev || currDate !== prevDate;
      const sameSender = !!prev && prev.senderUserId === message.senderUserId;
      const closeInTime =
        !!prev &&
        !!prev.createdAt &&
        !!message.createdAt &&
        new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < 60000;
      out.push({
        message,
        showDate,
        grouped: sameSender && closeInTime && !showDate,
        dateLabel: showDate && message.createdAt ? getDateLabel(message.createdAt) : '',
      });
    }
    return out.reverse();
  }, [messages]);

  // The id of my most recent message that the other side has read (for the
  // single "Read" receipt under the last read sent message).
  const lastReadMineId = useMemo(() => {
    if (!otherLastReadAt || !myUserId) return null;
    const readTs = new Date(otherLastReadAt).getTime();
    let id: string | null = null;
    for (const m of messages) {
      if (m.senderUserId === myUserId && m.createdAt && new Date(m.createdAt).getTime() <= readTs) {
        id = m.id;
      }
    }
    return id;
  }, [otherLastReadAt, myUserId, messages]);

  const headerTitle = other ? (other.handle ? `@${other.handle}` : other.name) : 'Conversation';

  // ─── Render a single bubble ────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      const { message } = item;
      const isMine = message.senderUserId === myUserId;
      const bubbleBg = isMine ? colors.messageSent : colors.messageReceived;
      const bubbleText = isMine ? colors.messageSentText : colors.messageReceivedText;
      const subText = bubbleText + 'A6';
      const media = (message.mediaUrls || [])
        .map((u) => resolveMediaUrl(u))
        .filter((u): u is string => !!u);
      const showRead = isMine && message.id === lastReadMineId;

      return (
        <View>
          <View
            style={[
              styles.line,
              { justifyContent: isMine ? 'flex-end' : 'flex-start', marginTop: item.grouped ? 1 : 8 },
            ]}
          >
            <View style={styles.column}>
              {/* Other-circle sender label (group chat: name the person) */}
              {!isMine && !item.grouped && message.senderName ? (
                <AppText variant="caption" muted weight="600" style={styles.senderLabel}>
                  {message.senderName}
                </AppText>
              ) : null}

              <View
                style={[
                  styles.bubble,
                  { backgroundColor: bubbleBg, borderRadius: radius.card },
                ]}
              >
                {media.length > 0 ? (
                  <View style={message.content ? styles.mediaWithText : undefined}>
                    {media.map((uri) =>
                      isVideoUrl(uri) ? (
                        <View
                          key={uri}
                          style={[styles.mediaTile, { backgroundColor: colors.surfaceHover }]}
                        >
                          <AppText variant="caption" muted center>Video</AppText>
                        </View>
                      ) : (
                        <Image
                          key={uri}
                          source={{ uri }}
                          style={styles.mediaTile}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          recyclingKey={uri}
                          transition={150}
                        />
                      ),
                    )}
                  </View>
                ) : null}

                {message.content ? (
                  <AppText variant="body" color={bubbleText}>
                    {message.content}
                  </AppText>
                ) : null}

                {!item.grouped ? (
                  <View
                    style={[
                      styles.metaRow,
                      { justifyContent: isMine ? 'flex-end' : 'flex-start' },
                    ]}
                  >
                    <AppText variant="caption" color={subText} style={styles.time}>
                      {formatTime(message.createdAt)}
                    </AppText>
                  </View>
                ) : null}
              </View>

              {showRead ? (
                <AppText variant="caption" color={colors.info} weight="600" style={styles.readReceipt}>
                  Read
                </AppText>
              ) : null}
            </View>
          </View>

          {/* Date separator sits BELOW the first message of a day in an inverted list. */}
          {item.showDate ? (
            <View style={styles.dateRow}>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
              <AppText variant="caption" muted weight="600" style={styles.dateLabel}>
                {item.dateLabel}
              </AppText>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            </View>
          ) : null}
        </View>
      );
    },
    [myUserId, colors, radius.card, lastReadMineId],
  );

  const hasText = value.trim().length > 0;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Touchable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backBtn}
        >
          <ChevronLeft color={colors.text} size={26} />
        </Touchable>
        <Pressable
          style={styles.headerCenter}
          onPress={
            other ? () => router.push(`/circles/${encodeURIComponent(other.handle ?? other.id)}`) : undefined
          }
          disabled={!other}
        >
          <Avatar uri={resolveMediaUrl(other?.avatarUrl)} name={other?.name} size={36} />
          <AppText variant="subtitle" weight="bold" numberOfLines={1} style={styles.headerTitle}>
            {headerTitle}
          </AppText>
        </Pressable>
        <View style={styles.headerSide} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.flex, isWide && styles.centerColumn]}>
          {loading ? (
            <View style={styles.skeletons}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[styles.skelRow, { justifyContent: i % 2 ? 'flex-end' : 'flex-start' }]}
                >
                  <Skeleton width={160 + (i % 3) * 40} height={42} radius={16} />
                </View>
              ))}
            </View>
          ) : error ? (
            <View style={styles.flex}>
              <EmptyState
                icon={<MessageCircle color={colors.error} size={40} />}
                title="Couldn't load"
                subtitle={error}
              />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.flex}>
              <EmptyState
                icon={<MessageCircle color={colors.primary} size={44} />}
                title="Start the conversation"
                subtitle={`Say hi to ${headerTitle}.`}
              />
            </View>
          ) : (
            <FlatList
              data={rows}
              inverted
              keyExtractor={(r) => r.message.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              onEndReached={loadOlder}
              onEndReachedThreshold={0.4}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.loadMore}>
                    <Spinner size="small" />
                  </View>
                ) : null
              }
            />
          )}

          {otherTyping ? <TypingIndicator partnerName={headerTitle} /> : null}
        </View>

        {/* Composer */}
        <View style={isWide ? styles.centerColumn : undefined}>
          <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <Pressable
              onPress={handleAttach}
              disabled={attaching || sending}
              style={styles.circleBtn}
              accessibilityLabel="Attach image"
            >
              {attaching ? <Spinner size="small" /> : <Plus color={colors.textMuted} size={22} />}
            </Pressable>

            <TextInput
              value={value}
              onChangeText={handleChange}
              placeholder={`Message ${headerTitle}...`}
              placeholderTextColor={colors.textMuted}
              editable={!sending}
              multiline
              style={[
                styles.input,
                {
                  backgroundColor: colors.backgroundAlt,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: radius.input,
                },
              ]}
            />

            <Pressable
              onPress={handleSend}
              disabled={!hasText || sending}
              style={[
                styles.sendBtn,
                { backgroundColor: hasText ? colors.primary : colors.surfaceHover },
              ]}
              accessibilityLabel="Send message"
            >
              {sending ? (
                <Spinner size="small" color={colors.textOnPrimary} />
              ) : (
                <Send color={hasText ? colors.textOnPrimary : colors.textMuted} size={18} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerColumn: { width: '100%', maxWidth: THREAD_MAX_WIDTH, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { flexShrink: 1 },
  headerSide: { width: 40 },
  listContent: { paddingHorizontal: 12, paddingVertical: 12 },
  line: { flexDirection: 'row', paddingHorizontal: 4 },
  column: { maxWidth: '78%' },
  senderLabel: { marginBottom: 2, marginLeft: 4 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8 },
  mediaWithText: { marginBottom: 6 },
  mediaTile: { width: 220, height: 220, borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  time: { fontSize: 10 },
  readReceipt: { alignSelf: 'flex-end', marginTop: 2, marginRight: 4, fontSize: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 4 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateLabel: { paddingHorizontal: 12 },
  skeletons: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  skelRow: { flexDirection: 'row' },
  loadMore: { paddingVertical: 12, alignItems: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
