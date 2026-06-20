'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Play, History, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { Button, Input, Spinner, Emoji } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import {
  WatchPlayer,
  type WatchPlayerHandle,
  type WatchMedia,
} from '@/components/watch/watch-player';
import { ChatPanel } from '@/components/watch/chat-panel';
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
  if (m.source === 'url' && m.videoUrl) return { source: 'url', src: m.videoUrl };
  if (m.videoId) return { source: 'youtube', src: m.videoId };
  if (m.videoUrl) return { source: 'url', src: m.videoUrl };
  return null;
}

export default function WatchPage() {
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

  // ---- Empty state (not paired) -----------------------------------------

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LinkupMark size={56} className="mb-4" />
        <h2 className="text-lg font-semibold text-text">Watch together</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to start a synchronized watch party.
        </p>
      </div>
    );
  }

  const hasParty = !!party;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center gap-2">
        <Clapperboard className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-text">Watch Party</h1>
          <p className="text-sm text-text-muted">
            Watch YouTube or a direct video link in sync with your partner
          </p>
        </div>
      </div>

      {/* Start / control bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startParty(urlInput);
        }}
        className="mb-4 flex flex-col gap-2 sm:flex-row"
      >
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Paste a YouTube link or a direct video URL (.mp4, .webm…)"
          className="flex-1"
        />
        <Button type="submit" loading={starting} disabled={!urlInput.trim()}>
          <Play className="h-4 w-4" />
          {hasParty ? 'Change video' : 'Start party'}
        </Button>
        {hasParty && (
          <Button type="button" variant="destructive" onClick={endParty}>
            <X className="h-4 w-4" />
            End party
          </Button>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Player + history */}
        <div className="space-y-4">
          <div className="relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/40">
                <Spinner size="lg" />
              </div>
            )}
            {/* The player mounts immediately so the API is ready before a video
                is chosen. An overlay covers it when no party is active. */}
            <WatchPlayer
              ref={playerRef}
              onLocalPlay={(t) => emitState('play', t)}
              onLocalPause={(t) => emitState('pause', t)}
              onLocalSeek={(t) => emitState('seek', t)}
              onError={(message) =>
                pushToast({ title: 'Playback error', body: message, variant: 'info' })
              }
            />

            {!hasParty && !loading && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-surface/80 text-center backdrop-blur-sm">
                <LinkupMark size={44} className="mb-3" />
                <p className="text-sm font-medium text-text">
                  No active watch party
                </p>
                <p className="mt-1 max-w-xs text-sm text-text-muted">
                  Paste a YouTube link or direct video URL above to start
                  watching together.
                </p>
              </div>
            )}

            {/* Floating reactions */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {reactions.map((r) => (
                <span
                  key={r.id}
                  className="watch-reaction-float absolute bottom-6"
                  style={{ left: `${r.left}%` }}
                >
                  <Emoji emoji={r.emoji} size={36} />
                </span>
              ))}
            </div>
          </div>

          {party?.title && (
            <h2 className="text-base font-semibold text-text">{party.title}</h2>
          )}

          {/* History */}
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <History className="h-4 w-4 text-text-muted" />
              <h3 className="text-sm font-semibold text-text">Recent parties</h3>
            </div>
            {history.length === 0 ? (
              <p className="py-2 text-sm text-text-muted">
                Your past watch parties will appear here.
              </p>
            ) : (
              <ul className="space-y-1">
                {history.map((h) => {
                  const isUrl = h.source === 'url';
                  const ref = isUrl ? h.videoUrl ?? '' : h.videoId ?? '';
                  return (
                    <li key={h.id}>
                      <button
                        onClick={() => startParty(ref, h.title ?? undefined)}
                        disabled={!ref}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                          <Play className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">
                            {h.title || (isUrl ? 'Direct video' : 'YouTube video')}
                          </p>
                          <p className="truncate font-mono text-xs text-text-muted">
                            {ref}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Chat side panel */}
        <div className="h-[32rem] lg:h-auto lg:min-h-[28rem]">
          <ChatPanel
            messages={messages}
            onSend={sendChat}
            onReact={sendReaction}
            disabled={!hasParty}
          />
        </div>
      </div>

      <style jsx global>{`
        @keyframes watchReactionFloat {
          0% {
            transform: translateY(0) scale(0.8);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translateY(-180px) scale(1.3);
            opacity: 0;
          }
        }
        .watch-reaction-float {
          animation: watchReactionFloat 2.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
