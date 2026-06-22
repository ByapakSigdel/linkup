import { useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeartCrack } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, EmptyState } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useSocket } from '@/hooks/use-socket';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { HighlightPicker } from '@/components/chat/highlight-picker';
import { resolveMediaUrl } from '@/lib/env';
import { useResponsive } from '@/hooks/use-responsive';
import api from '@/lib/api';
import type { Message, HighlightCategory } from '@/types';

// Comfortable reading column for the conversation on tablets so bubbles don't
// stretch edge-to-edge. Phones (isWide === false) keep full width.
const CHAT_MAX_WIDTH = 760;

export default function ChatScreen() {
  const { colors } = useTheme();
  const { isWide } = useResponsive();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  const messages = useChatStore((s) => s.messages);
  const isPartnerTyping = useChatStore((s) => s.isPartnerTyping);
  const isPartnerOnline = useChatStore((s) => s.isPartnerOnline);
  const partnerLastSeenAt = useChatStore((s) => s.partnerLastSeenAt);
  const highlightingMessage = useChatStore((s) => s.highlightingMessage);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const setHighlightingMessage = useChatStore((s) => s.setHighlightingMessage);
  const highlightMessage = useChatStore((s) => s.highlightMessage);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const reset = useChatStore((s) => s.reset);

  const { sendMessage, markAsRead, startTyping, stopTyping, requestPresence } = useSocket();

  const partnerId =
    couple && user
      ? couple.partner1Id === user.id
        ? couple.partner2Id
        : couple.partner1Id
      : null;
  const partnerName = couple?.coupleName || 'Partner';

  // Load messages on mount; clear unread; refresh presence.
  useEffect(() => {
    useChatStore.getState().setChatOpen(true);
    if (couple?.id) {
      void fetchMessages(couple.id);
      requestPresence();
    }
    return () => {
      useChatStore.getState().setChatOpen(false);
      reset();
    };
  }, [couple?.id, fetchMessages, requestPresence, reset]);

  // Mark incoming messages as read.
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const unread = messages.filter((m) => m.receiverId === user.id && m.status !== 'read');
    for (const msg of unread) markAsRead(msg.id);
  }, [messages, user, markAsRead]);

  const handleSend = useCallback(
    (content: string, options?: { threadId?: string; isThreadStarter?: boolean }) => {
      sendMessage(content, options);
    },
    [sendMessage],
  );

  const handleEditSend = useCallback(async (messageId: string, content: string) => {
    try {
      const { data } = await api.patch(`/messages/${messageId}`, { content });
      if (data.success) {
        useChatStore.getState().updateMessage(messageId, {
          content,
          isEdited: true,
          editedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  }, []);

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}`);
      useChatStore.getState().removeMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, []);

  const handleReply = useCallback((message: Message) => setReplyingTo(message), [setReplyingTo]);
  const handleEdit = useCallback((message: Message) => setEditingMessage(message), [setEditingMessage]);
  const handleHighlight = useCallback(
    (message: Message) => setHighlightingMessage(message),
    [setHighlightingMessage],
  );

  const handleHighlightSelect = useCallback(
    async (category: HighlightCategory, color: string) => {
      const target = useChatStore.getState().highlightingMessage;
      if (!target) return;
      try {
        await api.post(`/messages/${target.id}/highlight`, { category, color });
        highlightMessage(target.id, category, color);
      } catch (error) {
        console.error('Failed to highlight message:', error);
        highlightMessage(target.id, category, color);
      }
      setHighlightingMessage(null);
    },
    [highlightMessage, setHighlightingMessage],
  );

  const handleReact = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user) return;
      try {
        await api.post(`/messages/${messageId}/reactions`, { emoji });
        useChatStore.getState().addReaction(messageId, {
          userId: user.id,
          emoji,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to add reaction:', error);
      }
    },
    [user],
  );

  // Not coupled yet
  if (!couple?.isPaired) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
        <EmptyState
          icon={<HeartCrack color={colors.primary} size={48} />}
          title="No partner linked yet"
          subtitle="Link up with your partner to start chatting. Go to settings to create or accept an invite."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ChatHeader
        partnerName={partnerName}
        partnerAvatar={couple?.coupleAvatarUrl}
        partnerId={partnerId}
        isOnline={isPartnerOnline}
        lastSeenAt={partnerLastSeenAt}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.flex, isWide && styles.column]}>
          <MessageList
            onReply={handleReply}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onHighlight={handleHighlight}
            onReact={handleReact}
          />

          {isPartnerTyping ? <TypingIndicator partnerName={partnerName} /> : null}
        </View>

        {/* Highlight picker overlay */}
        {highlightingMessage ? (
          <Pressable
            style={styles.overlay}
            onPress={() => setHighlightingMessage(null)}
          >
            <View style={styles.pickerWrap} pointerEvents="box-none">
              <HighlightPicker
                onSelect={handleHighlightSelect}
                onClose={() => setHighlightingMessage(null)}
              />
            </View>
          </Pressable>
        ) : null}

        <View style={isWide ? styles.column : undefined}>
          <MessageInput
            onSend={handleSend}
            onEditSend={handleEditSend}
            onTypingStart={startTyping}
            onTypingStop={stopTyping}
            partnerName={partnerName}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Centered reading column on tablets/wide screens (phones unaffected).
  column: { width: '100%', maxWidth: CHAT_MAX_WIDTH, alignSelf: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerWrap: { alignItems: 'center', justifyContent: 'center' },
});
