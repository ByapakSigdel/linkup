'use client';

import { useEffect } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import { useCallStore, type CallType } from '@/stores/call-store';
import { useToastStore } from '@/stores/toast-store';
import { CallManager } from '@/components/call/call-manager';
import { ToastContainer } from '@/components/realtime/toast-container';
import type { Message, PresenceUpdate, TypingIndicator } from '@linkup/types';

/**
 * Owns the single shared socket connection and all inbound realtime event
 * wiring for the whole authenticated app. Feature-specific hooks may attach
 * their own additional listeners to the same socket via getSocket().
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.tokens?.accessToken);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);

    const onConnect = () => useChatStore.getState().setConnected(true);
    const onDisconnect = () => useChatStore.getState().setConnected(false);

    const onMessageNew = (message: Message) => {
      useChatStore.getState().addMessage(message);
    };
    const onMessageRead = (data: { messageId: string; readAt: string }) => {
      useChatStore.getState().updateMessageStatus(data.messageId, 'read', data.readAt);
    };
    const onMessageEdited = (message: Message) => {
      useChatStore.getState().updateMessage(message.id, message);
    };
    const onMessageDeleted = (data: { messageId: string }) => {
      useChatStore.getState().removeMessage(data.messageId);
    };
    const onTyping = (indicator: TypingIndicator) => {
      useChatStore.getState().setPartnerTyping(indicator.isTyping);
    };
    const onPresence = (presence: PresenceUpdate) => {
      useChatStore.getState().setPartnerPresence(presence.isOnline, presence.lastSeenAt);
    };
    const onReaction = (data: {
      messageId: string;
      reaction: { userId: string; emoji: string; timestamp: string };
    }) => {
      useChatStore.getState().addReaction(data.messageId, data.reaction);
    };

    const onNotification = (notification: any) => {
      const store = useNotificationsStore.getState();
      useNotificationsStore.setState({
        notifications: [notification, ...store.notifications],
        unreadCount: store.unreadCount + 1,
      });
    };

    const onCallIncoming = (data: {
      callType: CallType;
      from?: { id?: string; displayName?: string; avatarUrl?: string };
    }) => {
      const phase = useCallStore.getState().phase;
      if (phase !== 'idle') {
        // Busy: auto-decline
        getSocket()?.emit('call:decline');
        return;
      }
      useCallStore.getState().setIncoming(data.callType, data.from ?? {});
    };

    const onSoundboardPlay = (data: { audioUrl: string; name?: string }) => {
      try {
        const audio = new Audio(data.audioUrl);
        audio.volume = 0.9;
        void audio.play();
      } catch {
        /* ignore autoplay failures */
      }
      useToastStore.getState().push({
        title: 'Soundboard',
        body: `Partner played ${data.name || 'a sound'} 🔊`,
        icon: '🔊',
        variant: 'info',
      });
    };

    const onAchievementUnlocked = (data: {
      achievement: { name: string; description: string; iconUrl?: string };
      points: number;
    }) => {
      useToastStore.getState().push({
        title: `Achievement Unlocked! +${data.points}pts`,
        body: `${data.achievement.name} — ${data.achievement.description}`,
        icon: data.achievement.iconUrl || '🏆',
        variant: 'achievement',
      });
    };

    const onWatchInvite = (data: { party?: { title?: string } }) => {
      useToastStore.getState().push({
        title: 'Watch Party',
        body: `Partner started watching ${data.party?.title || 'a video'}. Join from the Watch page!`,
        icon: '🎬',
        variant: 'info',
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessageNew);
    socket.on('message:read', onMessageRead);
    socket.on('message:edited', onMessageEdited);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('typing:update', onTyping);
    socket.on('presence:update', onPresence);
    socket.on('reaction:added', onReaction);
    socket.on('notification:new', onNotification);
    socket.on('call:incoming', onCallIncoming);
    socket.on('soundboard:play', onSoundboardPlay);
    socket.on('achievement:unlocked', onAchievementUnlocked);
    socket.on('watch:invite', onWatchInvite);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessageNew);
      socket.off('message:read', onMessageRead);
      socket.off('message:edited', onMessageEdited);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('typing:update', onTyping);
      socket.off('presence:update', onPresence);
      socket.off('reaction:added', onReaction);
      socket.off('notification:new', onNotification);
      socket.off('call:incoming', onCallIncoming);
      socket.off('soundboard:play', onSoundboardPlay);
      socket.off('achievement:unlocked', onAchievementUnlocked);
      socket.off('watch:invite', onWatchInvite);
    };
  }, [token]);

  return (
    <>
      {children}
      <CallManager />
      <ToastContainer />
    </>
  );
}
