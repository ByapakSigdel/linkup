'use client';

import { useCallback, useEffect, useRef } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useGamesStore } from '@/stores/games-store';

export interface GameSession {
  /** Stable role for this player ('a' goes first / is X). Both sides agree. */
  role: 'a' | 'b';
  /** True when the partner is currently in THIS game. */
  partnerHere: boolean;
  /** Send a game-specific message to the partner. */
  send: (data: unknown) => void;
  myId: string | undefined;
  partnerId: string | undefined;
}

/**
 * Shared 2-player game session over the single `game:event` socket relay.
 * - Announces presence on mount (so the partner's lobby shows "join"), and
 *   answers presence pings so both sides learn each other's current game.
 * - `send`/`onMessage` carry game-specific moves/state; the server only relays.
 * - `role` is derived deterministically from the two user ids so both clients
 *   agree on who is player A (first move / X) without negotiation.
 */
export function useGameSession(
  gameKey: string,
  onMessage?: (data: unknown, from: string) => void,
): GameSession {
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const couple = useAuthStore((s) => s.couple);
  const partnerInGame = useGamesStore((s) => s.partnerInGame);

  const partnerId = couple
    ? couple.partner1Id === userId
      ? couple.partner2Id ?? undefined
      : couple.partner1Id
    : undefined;

  const role: 'a' | 'b' =
    userId && partnerId ? (userId < partnerId ? 'a' : 'b') : 'a';

  const partnerHere = partnerInGame === gameKey;

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const send = useCallback(
    (data: unknown) => {
      getSocket()?.emit('game:event', { t: 'msg', game: gameKey, data });
    },
    [gameKey],
  );

  useEffect(() => {
    if (!token) return;
    const socket = getSocket() ?? connectSocket(token);
    useGamesStore.getState().setMyGame(gameKey);

    const onEvent = (payload: { t?: string; game?: string; data?: unknown; by?: string }) => {
      if (payload?.t === 'msg' && payload.game === gameKey) {
        onMessageRef.current?.(payload.data, payload.by ?? '');
      }
    };
    socket.on('game:event', onEvent);

    // Announce I'm here, and ask the partner to re-announce their current game.
    socket.emit('game:event', { t: 'present', game: gameKey });
    socket.emit('game:event', { t: 'present-req' });

    return () => {
      socket.off('game:event', onEvent);
      useGamesStore.getState().setMyGame(null);
      getSocket()?.emit('game:event', { t: 'present', game: null });
    };
  }, [token, gameKey]);

  return { role, partnerHere, send, myId: userId, partnerId };
}
