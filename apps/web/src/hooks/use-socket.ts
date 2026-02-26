'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import type { Message, PresenceUpdate, TypingIndicator } from '@linkup/types';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

interface UseSocketReturn {
  socket: Socket | null;
  sendMessage: (content: string, options?: { threadId?: string; isThreadStarter?: boolean }) => string | null;
  markAsRead: (messageId: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  requestPresence: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const tokens = useAuthStore((s) => s.tokens);
  const couple = useAuthStore((s) => s.couple);

  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessageStatus = useChatStore((s) => s.updateMessageStatus);
  const setPartnerTyping = useChatStore((s) => s.setPartnerTyping);
  const setPartnerPresence = useChatStore((s) => s.setPartnerPresence);

  // Connect
  useEffect(() => {
    if (!tokens?.accessToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: tokens.accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      useChatStore.getState().setConnected(true);
    });

    socket.on('disconnect', () => {
      useChatStore.getState().setConnected(false);
    });

    // Incoming message from partner
    socket.on('message:new', (message: Message) => {
      addMessage(message);
    });

    // Our message was read by partner
    socket.on('message:read', (data: { messageId: string; readAt: string }) => {
      updateMessageStatus(data.messageId, 'read', data.readAt);
    });

    // Message edited by partner
    socket.on('message:edited', (message: Message) => {
      useChatStore.getState().updateMessage(message.id, message);
    });

    // Message deleted by partner
    socket.on('message:deleted', (data: { messageId: string }) => {
      useChatStore.getState().removeMessage(data.messageId);
    });

    // Partner typing indicator
    socket.on('typing:update', (indicator: TypingIndicator) => {
      setPartnerTyping(indicator.isTyping);
    });

    // Partner presence
    socket.on('presence:update', (presence: PresenceUpdate) => {
      setPartnerPresence(presence.isOnline, presence.lastSeenAt);
    });

    // Reaction added
    socket.on(
      'reaction:added',
      (data: { messageId: string; reaction: { userId: string; emoji: string; timestamp: string } }) => {
        useChatStore.getState().addReaction(data.messageId, data.reaction);
      },
    );

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      useChatStore.getState().setConnected(false);
    };
  }, [tokens?.accessToken, addMessage, updateMessageStatus, setPartnerTyping, setPartnerPresence]);

  // Send message via WebSocket
  const sendMessage = useCallback(
    (content: string, options?: { threadId?: string; isThreadStarter?: boolean }) => {
      const socket = socketRef.current;
      const state = useAuthStore.getState();
      const user = state.user;
      const coupleState = state.couple;

      if (!socket?.connected || !user || !coupleState) return null;

      // Determine the receiver (partner)
      const receiverId =
        coupleState.partner1Id === user.id
          ? coupleState.partner2Id
          : coupleState.partner1Id;

      if (!receiverId) return null;

      const payload = {
        coupleId: coupleState.id,
        receiverId,
        content,
        messageType: 'text',
        ...options,
      };

      // Optimistic message for local display
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        coupleId: coupleState.id,
        senderId: user.id,
        receiverId,
        content,
        messageType: 'text',
        status: 'sending',
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        threadId: options?.threadId,
        isThreadStarter: options?.isThreadStarter,
      };

      addMessage(optimisticMessage);

      socket.emit('message:send', payload, (response: { event?: string; data?: Message; error?: string }) => {
        if (response?.error) {
          // Mark optimistic message as failed
          updateMessageStatus(optimisticMessage.id, 'failed');
        } else if (response?.data) {
          // Replace optimistic message with server response
          useChatStore.getState().replaceOptimisticMessage(optimisticMessage.id, response.data);
        }
      });

      return optimisticMessage.id;
    },
    [addMessage, updateMessageStatus],
  );

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    socketRef.current?.emit('message:read', { messageId });
  }, []);

  // Typing indicators
  const startTyping = useCallback(() => {
    const coupleState = useAuthStore.getState().couple;
    if (!coupleState) return;
    socketRef.current?.emit('typing:start', { coupleId: coupleState.id });
  }, []);

  const stopTyping = useCallback(() => {
    const coupleState = useAuthStore.getState().couple;
    if (!coupleState) return;
    socketRef.current?.emit('typing:stop', { coupleId: coupleState.id });
  }, []);

  // Request partner's current presence
  const requestPresence = useCallback(() => {
    socketRef.current?.emit('presence:update', {}, (response: { data?: PresenceUpdate }) => {
      if (response?.data) {
        setPartnerPresence(response.data.isOnline, response.data.lastSeenAt);
      }
    });
  }, [setPartnerPresence]);

  return {
    socket: socketRef.current,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    requestPresence,
  };
}
