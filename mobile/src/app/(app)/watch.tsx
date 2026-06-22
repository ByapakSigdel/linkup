import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Clapperboard, History, Play, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';
import {
  Screen,
  AppText,
  Card,
  Input,
  Button,
  Spinner,
  EmptyState,
  Row,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useResponsive } from '@/hooks/use-responsive';
import {
  WatchPlayer,
  type WatchPlayerHandle,
  type WatchMedia,
} from '@/components/watch/watch-player';
import { ChatPanel } from '@/components/watch/chat-panel';
import { FloatingReactions } from '@/components/watch/floating-reactions';
import { resolveWatchSource } from '@/components/watch/youtube';
import type {
  WatchParty,
  ChatMessage,
  FloatingReaction,
  WatchLoadPayload,
  WatchStatePayload,
  WatchChatPayload,
  WatchReactionPayload,
} from '@/components/watch/types';

function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message || fallback;
}

/** Turn a stored party / socket payload into the media the player should load. */
function toMedia(
  m:
    | { source?: string | null; videoId?: string | null; videoUrl?: string | null }
    | null
    | undefined,
): WatchMedia | null {
  if (!m) return null;
  if (m.source === 'url' && m.videoUrl) {
    return { source: 'url', src: resolveMediaUrl(m.videoUrl) ?? m.videoUrl };
  }
  if (m.videoId) return { source: 'youtube', src: m.videoId };
  if (m.videoUrl) {
    return { source: 'url', src: resolveMediaUrl(m.videoUrl) ?? m.videoUrl };
  }
  return null;
}

export default function WatchScreen() {
  const { colors, radius } = useTheme();
  const { isWide, isLandscape, contentMaxWidth } = useResponsive();
  // On a wide landscape tablet the player + live chat sit side-by-side.
  const sideBySide = isWide && isLandscape;
  const centered = contentMaxWidth
    ? { maxWidth: sideBySide ? 1100 : contentMaxWidth, width: '100%' as const, alignSelf: 'center' as const }
    : null;
  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);

  const playerRef = useRef<WatchPlayerHandle | null>(null);
  // Guards against feedback loops while applying a remote action.
  const applyingRemoteRef = useRef(false);

  const [party, setParty] = useState<WatchParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [history, setHistory] = useState<WatchParty[]>([]);

  // ---- Initial load ------------------------------------------------------

  const loadActive = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/entertainment/watch/active');
      const active: WatchParty | null = data.data.party ?? null;
      setParty(active);
      const media = toMedia(active);
      if (media) playerRef.current?.load(media);
    } catch {
      setParty(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/entertainment/watch/history', {
        params: { limit: 8 },
      });
      setHistory(data.data.parties ?? []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) {
      loadActive();
      loadHistory();
    }
  }, [couple?.isPaired, loadActive, loadHistory]);

  // ---- Sync emit (local actions) -----------------------------------------

  const emitState = useCallback(
    (action: WatchStatePayload['action'], time: number) => {
      if (applyingRemoteRef.current) return; // don't echo remote-driven actions
      getSocket()?.emit('watch:state', { action, time });
    },
    [],
  );

  // ---- Realtime listeners ------------------------------------------------

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onLoad = (payload: WatchLoadPayload) => {
      const media = toMedia(payload);
      if (!media) return;
      const source = payload.source ?? (payload.videoUrl ? 'url' : 'youtube');
      setParty((prev) => ({
        id: prev?.id ?? 'remote',
        source,
        videoId: payload.videoId ?? null,
        videoUrl: payload.videoUrl ?? null,
        title: payload.title ?? prev?.title ?? null,
        status: 'active',
      }));
      playerRef.current?.load(media);
    };

    const onState = (payload: WatchStatePayload) => {
      const p = playerRef.current;
      if (!p) return;
      applyingRemoteRef.current = true;
      try {
        if (payload.action === 'play') {
          p.seekTo(payload.time);
          p.play();
        } else if (payload.action === 'pause') {
          p.seekTo(payload.time);
          p.pause();
        } else if (payload.action === 'seek') {
          p.seekTo(payload.time);
        }
      } finally {
        // Release after the player has settled so our own state-change events
        // (triggered by the remote action) are not re-emitted.
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 600);
      }
    };

    const onChat = (payload: WatchChatPayload) => {
      const senderId = payload.userId ?? '';
      setMessages((prev) => [
        ...prev,
        {
          id: `${payload.timestamp ?? Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          userId: senderId,
          text: payload.text,
          timestamp: payload.timestamp ?? Date.now(),
          mine: !!user?.id && senderId === user.id,
        },
      ]);
    };

    const onReaction = (payload: WatchReactionPayload) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const left = 10 + Math.random() * 80;
      setReactions((prev) => [...prev, { id, emoji: payload.emoji, left }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2200);
    };

    socket.on('watch:load', onLoad);
    socket.on('watch:state', onState);
    socket.on('watch:chat', onChat);
    socket.on('watch:reaction', onReaction);

    return () => {
      socket.off('watch:load', onLoad);
      socket.off('watch:state', onState);
      socket.off('watch:chat', onChat);
      socket.off('watch:reaction', onReaction);
    };
  }, [user?.id]);

  // ---- Actions -----------------------------------------------------------

  const startParty = useCallback(
    async (rawUrl: string, title?: string) => {
      const resolved = resolveWatchSource(rawUrl);
      if (!resolved) {
        pushToast({
          title: 'Invalid link',
          body: 'Paste a YouTube link, a video id, or a direct video URL (.mp4, .webm…).',
          variant: 'info',
        });
        return;
      }
      setStarting(true);
      try {
        const { data } = await api.post('/entertainment/watch', {
          source: resolved.source,
          videoId: resolved.videoId ?? undefined,
          videoUrl: resolved.videoUrl ?? undefined,
          title: title || undefined,
        });
        const created: WatchParty = data.data.party;
        setParty(created);
        setUrlInput('');
        const media = toMedia(created);
        if (media) playerRef.current?.load(media);
        getSocket()?.emit('watch:load', {
          source: created.source,
          videoId: created.videoId ?? undefined,
          videoUrl: created.videoUrl ?? undefined,
          title: created.title ?? undefined,
        });
        loadHistory();
      } catch (err) {
        pushToast({
          title: 'Could not start party',
          body: errMessage(err, 'Please try again.'),
          variant: 'info',
        });
      } finally {
        setStarting(false);
      }
    },
    [pushToast, loadHistory],
  );

  const endParty = useCallback(async () => {
    if (!party?.id || party.id === 'remote') {
      setParty(null);
      return;
    }
    try {
      await api.post(`/entertainment/watch/${party.id}/end`);
      playerRef.current?.pause();
      setParty(null);
      setMessages([]);
      pushToast({ title: 'Party ended', variant: 'success' });
      loadHistory();
    } catch (err) {
      pushToast({
        title: 'Could not end party',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    }
  }, [party, pushToast, loadHistory]);

  const sendChat = useCallback((text: string) => {
    getSocket()?.emit('watch:chat', { text });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    getSocket()?.emit('watch:reaction', { emoji });
    // Optimistically float our own reaction too.
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const left = 10 + Math.random() * 80;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2200);
  }, []);

  // ---- Not paired --------------------------------------------------------

  if (!couple?.isPaired) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Watch Party" />
        <EmptyState
          icon={<Clapperboard color={colors.primary} size={48} />}
          title="Watch together"
          subtitle="Link up with your partner to start a synchronized watch party."
        />
      </Screen>
    );
  }

  const hasParty = !!party;

  return (
    <Screen scroll edges={['top']} padded={false}>
      <View style={[{ paddingHorizontal: 16 }, centered]}>
        <ScreenHeader
          title="Watch Party"
          subtitle="Watch YouTube or a direct video link in sync"
        />
      </View>

      <View style={[{ padding: 16, gap: 16 }, centered]}>
        {/* Start / control bar */}
        <View style={{ gap: 8 }}>
          <Input
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="Paste a YouTube link or direct video URL (.mp4, .webm…)"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => startParty(urlInput)}
          />
          <Row gap={8}>
            <Button
              onPress={() => startParty(urlInput)}
              loading={starting}
              disabled={!urlInput.trim()}
              leftIcon={<Play color={colors.textOnPrimary} size={16} />}
              label={hasParty ? 'Change video' : 'Start party'}
              style={{ flex: 1 }}
            />
            {hasParty ? (
              <Button
                variant="destructive"
                onPress={endParty}
                leftIcon={<X color="#fff" size={16} />}
                label="End"
              />
            ) : null}
          </Row>
        </View>

        {/* Player + chat — side-by-side on wide landscape, stacked otherwise */}
        <View
          style={
            sideBySide
              ? { flexDirection: 'row', gap: 16, alignItems: 'flex-start' }
              : { gap: 16 }
          }
        >
          <View style={sideBySide ? { flex: 1.6, gap: 16 } : { gap: 16 }}>
        {/* Player */}
        <View style={{ position: 'relative' }}>
          <WatchPlayer
            ref={playerRef}
            onLocalPlay={(t) => emitState('play', t)}
            onLocalPause={(t) => emitState('pause', t)}
            onLocalSeek={(t) => emitState('seek', t)}
            onError={(message) =>
              pushToast({ title: 'Playback error', body: message, variant: 'info' })
            }
          />

          {loading ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: radius.card,
                backgroundColor: 'rgba(0,0,0,0.4)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Spinner color="#fff" />
            </View>
          ) : null}

          {!hasParty && !loading ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: radius.card,
                backgroundColor: colors.surface + 'CC',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                gap: 6,
              }}
              pointerEvents="none"
            >
              <Clapperboard color={colors.primary} size={40} />
              <AppText variant="subtitle" center>
                No active watch party
              </AppText>
              <AppText muted center style={{ maxWidth: 280 }}>
                Paste a YouTube link or direct video URL above to start watching
                together.
              </AppText>
            </View>
          ) : null}

          <FloatingReactions reactions={reactions} />
        </View>

        {party?.title ? (
          <AppText variant="subtitle">{party.title}</AppText>
        ) : null}
          </View>

          {/* Chat side panel */}
          <View
            style={
              sideBySide
                ? { flex: 1, height: 520, minWidth: 280 }
                : { height: 460 }
            }
          >
            <ChatPanel
              messages={messages}
              onSend={sendChat}
              onReact={sendReaction}
              disabled={!hasParty}
            />
          </View>
        </View>

        {/* History */}
        <Card>
          <Row gap={8} style={{ marginBottom: 8 }}>
            <History color={colors.textMuted} size={16} />
            <AppText variant="label">Recent parties</AppText>
          </Row>
          {history.length === 0 ? (
            <AppText muted style={{ paddingVertical: 8 }}>
              Your past watch parties will appear here.
            </AppText>
          ) : (
            <View style={{ gap: 2 }}>
              {history.map((h) => {
                const isUrl = h.source === 'url';
                const ref = isUrl ? h.videoUrl ?? '' : h.videoId ?? '';
                return (
                  <Pressable
                    key={h.id}
                    onPress={() => startParty(ref, h.title ?? undefined)}
                    disabled={!ref}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: radius.button,
                      paddingHorizontal: 8,
                      paddingVertical: 8,
                      backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                      opacity: ref ? 1 : 0.5,
                    })}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        backgroundColor: colors.primaryLight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Play color={colors.primary} size={16} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <AppText variant="label" numberOfLines={1}>
                        {h.title || (isUrl ? 'Direct video' : 'YouTube video')}
                      </AppText>
                      <AppText variant="caption" muted numberOfLines={1}>
                        {ref}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}
