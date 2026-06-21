import { useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Heart } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, Spinner, EmptyState, Skeleton } from '@/components/ui';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { MessageBubble } from './message-bubble';
import type { Message } from '@/types';

interface MessageListProps {
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onHighlight?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

// Each rendered row carries its grouping/date metadata (computed in chronological
// order so it matches the web exactly, then consumed by the inverted list).
interface Row {
  message: Message;
  showDate: boolean;
  grouped: boolean;
  dateLabel: string;
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

function shouldShowDate(msg: Message, prev: Message | undefined): boolean {
  if (!prev) return true;
  const curr = new Date(msg.sentAt || msg.createdAt).toDateString();
  const p = new Date(prev.sentAt || prev.createdAt).toDateString();
  return curr !== p;
}

function isGrouped(msg: Message, prev: Message | undefined): boolean {
  if (!prev) return false;
  if (msg.senderId !== prev.senderId) return false;
  const diff =
    new Date(msg.sentAt || msg.createdAt).getTime() -
    new Date(prev.sentAt || prev.createdAt).getTime();
  return diff < 60000;
}

export function MessageList({
  onReply,
  onEdit,
  onDelete,
  onHighlight,
  onReact,
}: MessageListProps) {
  const { colors } = useTheme();
  const messages = useChatStore((s) => s.messages);
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const couple = useAuthStore((s) => s.couple);

  // Build chronological rows (with grouping/date), then reverse for the inverted list.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;
      const prev = i > 0 ? messages[i - 1] : undefined;
      const showDate = shouldShowDate(message, prev);
      out.push({
        message,
        showDate,
        grouped: isGrouped(message, prev),
        dateLabel: showDate ? getDateLabel(message.sentAt || message.createdAt) : '',
      });
    }
    return out.reverse();
  }, [messages]);

  const loadOlder = () => {
    if (isLoadingMessages || !hasMoreMessages || !couple) return;
    void fetchMessages(couple.id, messages.length);
  };

  // Initial loading skeletons
  if (isLoadingMessages && messages.length === 0) {
    return (
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
    );
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <View style={styles.empty}>
        <EmptyState
          icon={<Heart color={colors.primary} size={44} />}
          title="Start your conversation"
          subtitle="Send your first message and start creating memories together."
        />
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      inverted
      keyExtractor={(r) => r.message.id}
      contentContainerStyle={styles.content}
      onEndReached={loadOlder}
      onEndReachedThreshold={0.4}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListFooterComponent={
        isLoadingMessages ? (
          <View style={styles.loadMore}>
            <Spinner size="small" />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <View>
          <MessageBubble
            message={item.message}
            showTimestamp={!item.grouped}
            isGroupedWithPrevious={item.grouped}
            onReply={onReply}
            onEdit={onEdit}
            onDelete={onDelete}
            onHighlight={onHighlight}
            onReact={onReact}
          />
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
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, paddingVertical: 12 },
  empty: { flex: 1 },
  skeletons: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  skelRow: { flexDirection: 'row' },
  loadMore: { paddingVertical: 12, alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 4 },
  dateLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dateLabel: { paddingHorizontal: 12 },
});
