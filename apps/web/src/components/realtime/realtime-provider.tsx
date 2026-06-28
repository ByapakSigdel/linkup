'use client';

import { useEffect } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useCircleDmStore } from '@/stores/circle-dm-store';
import * as circlesApi from '@/lib/circles-api';
import { useNotificationsStore } from '@/stores/notifications-store';
import { useCallStore, type CallType } from '@/stores/call-store';
import { useToastStore } from '@/stores/toast-store';
import { useThemeStore } from '@/stores/theme-store';
import { useGamesStore } from '@/stores/games-store';
import { CallManager } from '@/components/call/call-manager';
import { ToastContainer } from '@/components/realtime/toast-container';
import type { Message, PresenceUpdate, TypingIndicator } from '@linkup/types';
import type { CircleDmMessage } from '@/components/circles/types';

/**
 * Owns the single shared socket connection and all inbound realtime event
 * wiring for the whole authenticated app. Feature-specific hooks may attach
 * their own additional listeners to the same socket via getSocket().
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const isPaired = useAuthStore((s) => s.couple?.isPaired ?? false);

  // §Phase2 DM — seed the global Circle-DM unread badge from the inbox, and
  // resolve the viewer's own circle id so we can tell which `circle:dm:read`
  // events are ours (and should clear our badge) vs the other couple's.
  useEffect(() => {
    if (!token || !isPaired) {
      useCircleDmStore.getState().reset();
      return;
    }
    let cancelled = false;
    void circlesApi
      .getMyCircle()
      .then((res) => {
        if (cancelled) return;
        useCircleDmStore.getState().setMyCircleId(res.circle?.id ?? null);
      })
      .catch(() => {});
    void circlesApi
      .getConversations({ limit: 50 })
      .then((res) => {
        if (cancelled) return;
        useCircleDmStore.getState().setFromInbox(res.conversations);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, isPaired]);

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

    // §Phase2 DM — keep the global Circle-DM unread badge live app-wide. The
    // thread/inbox screens own their own in-screen state; this only drives the
    // chrome badges (sidebar + Circles header).
    const onCircleDmNew = (payload: {
      conversationId: string;
      message: CircleDmMessage;
    }) => {
      if (!payload?.message?.conversationId) return;
      const me = useAuthStore.getState().user?.id;
      // Only incoming messages (not our own echo) raise the badge.
      if (me && payload.message.senderUserId === me) return;
      useCircleDmStore.getState().bump(payload.conversationId);
    };
    const onCircleDmRead = (payload: {
      conversationId: string;
      circleId: string;
    }) => {
      if (!payload?.conversationId) return;
      // Only OUR circle's read marker clears OUR unread. The other couple
      // reading must not zero our badge.
      const myCircleId = useCircleDmStore.getState().myCircleId;
      if (myCircleId && payload.circleId !== myCircleId) return;
      useCircleDmStore.getState().clear(payload.conversationId);
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

    // Couple games: track which game the partner is in; answer presence pings.
    const onGameEvent = (p: { t?: string; game?: string | null }) => {
      if (!p) return;
      if (p.t === 'present') {
        useGamesStore.getState().setPartnerInGame(p.game ?? null);
      } else if (p.t === 'present-req') {
        getSocket()?.emit('game:event', {
          t: 'present',
          game: useGamesStore.getState().myGame,
        });
      }
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

    const onThemeChanged = (data: { themeId: string }) => {
      if (data?.themeId) {
        // Partner changed the shared theme — apply it locally without
        // re-broadcasting (that would loop).
        useThemeStore.getState().setTheme(data.themeId);
        const couple = useAuthStore.getState().couple;
        if (couple) {
          useAuthStore
            .getState()
            .setCouple({ ...couple, sharedThemeId: data.themeId });
        }
      }
    };

    const onWatchInvite = (data: { party?: { title?: string } }) => {
      useToastStore.getState().push({
        title: 'Watch Party',
        body: `Partner started watching ${data.party?.title || 'a video'}. Join from the Watch page!`,
        icon: '🎬',
        variant: 'info',
      });
    };

    // The partner deleted their account → the couple is now `ended`. Re-fetch the
    // couple so the dashboard shell re-gates the survivor into the memorial on the
    // next safe navigation (never interrupting an in-progress action mid-tap).
    const onCoupleEnded = () => {
      void useAuthStore.getState().refreshCouple();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('message:new', onMessageNew);
    socket.on('message:read', onMessageRead);
    socket.on('message:edited', onMessageEdited);
    socket.on('message:deleted', onMessageDeleted);
    socket.on('typing:update', onTyping);
    socket.on('circle:dm:new', onCircleDmNew);
    socket.on('circle:dm:read', onCircleDmRead);
    socket.on('presence:update', onPresence);
    socket.on('reaction:added', onReaction);
    socket.on('notification:new', onNotification);
    socket.on('call:incoming', onCallIncoming);
    socket.on('soundboard:play', onSoundboardPlay);
    socket.on('achievement:unlocked', onAchievementUnlocked);
    socket.on('watch:invite', onWatchInvite);
    socket.on('theme:changed', onThemeChanged);
    socket.on('game:event', onGameEvent);
    socket.on('couple:ended', onCoupleEnded);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('message:new', onMessageNew);
      socket.off('message:read', onMessageRead);
      socket.off('message:edited', onMessageEdited);
      socket.off('message:deleted', onMessageDeleted);
      socket.off('typing:update', onTyping);
      socket.off('circle:dm:new', onCircleDmNew);
      socket.off('circle:dm:read', onCircleDmRead);
      socket.off('presence:update', onPresence);
      socket.off('reaction:added', onReaction);
      socket.off('notification:new', onNotification);
      socket.off('call:incoming', onCallIncoming);
      socket.off('soundboard:play', onSoundboardPlay);
      socket.off('achievement:unlocked', onAchievementUnlocked);
      socket.off('watch:invite', onWatchInvite);
      socket.off('theme:changed', onThemeChanged);
      socket.off('game:event', onGameEvent);
      socket.off('couple:ended', onCoupleEnded);
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
