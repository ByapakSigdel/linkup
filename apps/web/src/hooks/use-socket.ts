'use client';

import { useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import type { Message, MessageType, PresenceUpdate } from '@linkup/types';

interface UseSocketReturn {
  socket: Socket | null;
  sendMessage: (
    content: string,
    options?: {
      threadId?: string;
      isThreadStarter?: boolean;
      messageType?: string;
      mediaUrls?: string[];
    },
  ) => string | null;
  markAsRead: (messageId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  requestPresence: () => void;
}

/**
 * Provides chat action helpers over the shared socket. The connection itself
 * and all inbound listeners are managed by <RealtimeProvider>.
 */
export function useSocket(): UseSocketReturn {
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);

  const sendMessage = useCallback(
    (
      content: string,
      options?: {
        threadId?: string;
        isThreadStarter?: boolean;
        messageType?: string;
        mediaUrls?: string[];
      },
    ) => {
      const socket = getSocket();
      const state = useAuthStore.getState();
      const user = state.user;
      const coupleState = state.couple;

      if (!socket?.connected || !user || !coupleState) return null;

      const receiverId =
        coupleState.partner1Id === user.id
          ? coupleState.partner2Id
          : coupleState.partner1Id;
      if (!receiverId) return null;

      const payload = {
        coupleId: coupleState.id,
        receiverId,
        content,
        messageType: (options?.messageType || 'text') as MessageType,
        mediaUrls: options?.mediaUrls,
        threadId: options?.threadId,
        isThreadStarter: options?.isThreadStarter,
      };

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        coupleId: coupleState.id,
        senderId: user.id,
        receiverId,
        content,
        messageType: (options?.messageType || 'text') as MessageType,
        mediaUrls: options?.mediaUrls,
        status: 'sending',
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        threadId: options?.threadId,
        isThreadStarter: options?.isThreadStarter,
      };

      addMessage(optimisticMessage);

      socket.emit(
        'message:send',
        payload,
        (response: { event?: string; data?: Message; error?: string }) => {
          if (response?.error) {
            updateMessageStatus(optimisticMessage.id, 'failed');
          } else if (response?.data) {
            useChatStore
              .getState()
              .replaceOptimisticMessage(optimisticMessage.id, response.data);
          }
        },
      );

      return optimisticMessage.id;
    },
    [addMessage, updateMessageStatus],
  );

  const markAsRead = useCallback((messageId: string) => {
    getSocket()?.emit('message:read', { messageId });
  }, []);

  const startTyping = useCallback(() => {
    const coupleState = useAuthStore.getState().couple;
    if (!coupleState) return;
    getSocket()?.emit('typing:start', { coupleId: coupleState.id });
  }, []);

  const stopTyping = useCallback(() => {
    const coupleState = useAuthStore.getState().couple;
    if (!coupleState) return;
    getSocket()?.emit('typing:stop', { coupleId: coupleState.id });
  }, []);

  const requestPresence = useCallback(() => {
    getSocket()?.emit(
      'presence:update',
      {},
      (response: { data?: PresenceUpdate }) => {
        if (response?.data) {
          useChatStore
            .getState()
            .setPartnerPresence(response.data.isOnline, response.data.lastSeenAt);
        }
      },
    );
  }, []);

  return {
    socket: getSocket(),
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    requestPresence,
  };
}
