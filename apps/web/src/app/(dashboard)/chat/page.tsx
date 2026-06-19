'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useSocket } from '@/hooks/use-socket';
import { ChatHeader } from '@/components/chat/chat-header';
import { MessageList } from '@/components/chat/message-list';
import { MessageInput } from '@/components/chat/message-input';
import { TypingIndicator } from '@/components/chat/typing-indicator';
import { HighlightPicker } from '@/components/chat/highlight-picker';
import { Spinner } from '@/components/ui';
import api from '@/lib/api';
import type { Message, HighlightCategory } from '@linkup/types';

export default function ChatPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  const messages = useChatStore((s) => s.messages);
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);
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

  const {
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    requestPresence,
  } = useSocket();

  // Determine partner info
  const partnerId =
    couple && user
      ? couple.partner1Id === user.id
        ? couple.partner2Id
        : couple.partner1Id
      : null;

  // We don't have partner user object directly in auth store,
  // so we use couple name or a placeholder
  const partnerName = couple?.coupleName || 'Partner';

  // Load messages on mount
  useEffect(() => {
    useChatStore.getState().setChatOpen(true); // clears the unread badge
    if (couple?.id) {
      fetchMessages(couple.id);
      requestPresence();
    }

    return () => {
      useChatStore.getState().setChatOpen(false);
      reset();
    };
  }, [couple?.id, fetchMessages, requestPresence, reset]);

  // Mark incoming messages as read when visible
  useEffect(() => {
    if (!user || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) => m.receiverId === user.id && m.status !== 'read',
    );

    for (const msg of unreadMessages) {
      markAsRead(msg.id);
    }
  }, [messages, user, markAsRead]);

  // Handler: send
  const handleSend = useCallback(
    (content: string, options?: { threadId?: string; isThreadStarter?: boolean }) => {
      sendMessage(content, options);
    },
    [sendMessage],
  );

  // Handler: edit send
  const handleEditSend = useCallback(
    async (messageId: string, content: string) => {
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
    },
    [],
  );

  // Handler: delete
  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}`);
      useChatStore.getState().removeMessage(messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }, []);

  // Handler: reply
  const handleReply = useCallback(
    (message: Message) => {
      setReplyingTo(message);
    },
    [setReplyingTo],
  );

  // Handler: edit
  const handleEdit = useCallback(
    (message: Message) => {
      setEditingMessage(message);
    },
    [setEditingMessage],
  );

  // Handler: highlight
  const handleHighlight = useCallback(
    (message: Message) => {
      setHighlightingMessage(message);
    },
    [setHighlightingMessage],
  );

  // Handler: highlight select
  const handleHighlightSelect = useCallback(
    async (category: HighlightCategory, color: string) => {
      if (!highlightingMessage) return;

      try {
        await api.post(`/messages/${highlightingMessage.id}/highlight`, {
          category,
          color,
        });
        highlightMessage(highlightingMessage.id, category, color);
      } catch (error) {
        console.error('Failed to highlight message:', error);
        // Still apply locally even if API fails
        highlightMessage(highlightingMessage.id, category, color);
      }

      setHighlightingMessage(null);
    },
    [highlightingMessage, highlightMessage, setHighlightingMessage],
  );

  // Handler: react
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
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="h-20 w-20 rounded-full bg-primary-light flex items-center justify-center mb-4">
          <span className="text-3xl">{'\uD83D\uDC94'}</span>
        </div>
        <h2 className="text-xl font-semibold text-text mb-2">
          No partner linked yet
        </h2>
        <p className="text-sm text-text-muted max-w-sm">
          Link up with your partner to start chatting. Go to settings to create
          or accept an invite.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-1.5rem)] -m-4 lg:-m-6 relative">
      {/* Header */}
      <ChatHeader
        partnerName={partnerName}
        partnerAvatar={couple?.coupleAvatarUrl}
        partnerId={partnerId}
        isOnline={isPartnerOnline}
        lastSeenAt={partnerLastSeenAt}
        onBack={() => router.back()}
      />

      {/* Message list */}
      <MessageList
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onHighlight={handleHighlight}
        onReact={handleReact}
      />

      {/* Typing indicator */}
      {isPartnerTyping && <TypingIndicator partnerName={partnerName} />}

      {/* Highlight picker overlay */}
      {highlightingMessage && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setHighlightingMessage(null)}
          />
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20">
            <HighlightPicker
              onSelect={handleHighlightSelect}
              onClose={() => setHighlightingMessage(null)}
            />
          </div>
        </>
      )}

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        onEditSend={handleEditSend}
        onTypingStart={startTyping}
        onTypingStop={stopTyping}
        partnerName={partnerName}
      />
    </div>
  );
}
