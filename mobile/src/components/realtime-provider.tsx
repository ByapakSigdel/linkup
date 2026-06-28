import { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { connectSocket, getSocket } from '@/lib/socket';
import { resolveMediaUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useNotificationsStore } from '@/stores/notifications-store';
import { useCallStore, type CallType } from '@/stores/call-store';
import { useToastStore } from '@/stores/toast-store';
import { useThemeStore } from '@/stores/theme-store';
import { useGamesStore } from '@/stores/games-store';
import { useTheme } from '@/theme';
import { AppText, Card } from '@/components/ui';
import { CallManager } from '@/components/call-manager';
import type { Message, PresenceUpdate, TypingIndicator } from '@/types';

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

    const onConnect = () => {
      useChatStore.getState().setConnected(true);
      // Ask the server for the partner's current presence (online + last seen).
      // The server only pushes presence on the partner's own connect/disconnect,
      // so without this the partner always looks offline until they toggle.
      socket.emit('presence:update');
    };
    const onDisconnect = () => useChatStore.getState().setConnected(false);

    const onMessageNew = (message: Message) => {
      const me = useAuthStore.getState().user?.id;
      const incoming = !!me && message.senderId !== me;
      const { chatOpen } = useChatStore.getState();
      useChatStore.getState().addMessage(message);
      // Notify on partner messages when the chat screen isn't open.
      if (incoming && !chatOpen) {
        const preview = (message.content || '').trim();
        useToastStore.getState().push({
          title: 'New message',
          body: preview ? preview.slice(0, 90) : 'Sent you a message 💬',
          icon: '💬',
          variant: 'info',
        });
      }
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
        const src = resolveMediaUrl(data.audioUrl);
        if (src) {
          const player = createAudioPlayer(src);
          player.volume = 0.9;
          player.play();
        }
      } catch {
        /* ignore playback failures */
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

    // The relationship has ended (a partner deleted their account). Re-fetch the
    // couple so the app shell re-gates the survivor into the read-only memorial
    // on the next safe navigation — never interrupting an in-progress action.
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
    socket.on('presence:update', onPresence);
    socket.on('presence:status', onPresence);
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
      socket.off('presence:update', onPresence);
      socket.off('presence:status', onPresence);
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
      <ToastHost />
      <CallManager />
    </>
  );
}

/**
 * Lightweight in-app toast host. Renders the toast-store queue as themed cards
 * stacked at the top of the screen. (Calls get their own full-screen host in
 * the call feature; this only covers passive notifications.)
 */
function ToastHost() {
  const { colors, radius } = useTheme();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {toasts.map((t) => {
        const accent =
          t.variant === 'achievement'
            ? colors.highlightCelebration
            : t.variant === 'success'
              ? colors.success
              : t.variant === 'info'
                ? colors.info
                : colors.primary;
        return (
          <Pressable key={t.id} onPress={() => dismiss(t.id)}>
            <Card
              variant="elevated"
              padded
              style={{
                marginBottom: 8,
                borderLeftWidth: 4,
                borderLeftColor: accent,
                borderRadius: radius.card,
              }}
            >
              <View style={styles.row}>
                {t.icon ? (
                  <AppText variant="title" style={styles.icon}>
                    {t.icon}
                  </AppText>
                ) : null}
                <View style={styles.body}>
                  <AppText variant="label" weight="bold" numberOfLines={1}>
                    {t.title}
                  </AppText>
                  {t.body ? (
                    <AppText variant="caption" muted numberOfLines={2}>
                      {t.body}
                    </AppText>
                  ) : null}
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 22,
  },
  body: {
    flex: 1,
  },
});
