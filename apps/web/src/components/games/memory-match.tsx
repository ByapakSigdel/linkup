'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Pool the host samples 8 emoji from each game (hearts / animals / food / sky). */
const POOL = [
  '❤️', '🌙', '⭐', '✨', '🔥', '🌸', '🍀',
  '🐱', '🐶', '🦊', '🐼', '🦋', '🐢', '🐝',
  '🍓', '🍰', '🍕', '🍦', '🍩', '🍒', '🥑',
] as const;

type Card2 = { emoji: string; owner: 'a' | 'b' | null }; // owner = who matched it

interface State {
  cards: Card2[]; // 16 cards
  flipped: number[]; // currently face-up indices being evaluated (0–2)
  turn: 'a' | 'b';
  scores: { a: number; b: number };
  lock: boolean; // briefly true during mismatch animation (host-driven)
  done: boolean;
}

const SIZE = 16;
const PAIRS = SIZE / 2;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Host-only: build a fresh shuffled board (Math.random — never in render/SSR). */
function freshState(scores: { a: number; b: number } = { a: 0, b: 0 }, starter: 'a' | 'b' = 'a'): State {
  const picks = shuffle([...POOL]).slice(0, PAIRS);
  const deck = shuffle([...picks, ...picks]).map((emoji) => ({ emoji, owner: null as 'a' | 'b' | null }));
  return {
    cards: deck,
    flipped: [],
    turn: starter,
    scores,
    lock: false,
    done: false,
  };
}

/** SSR-safe placeholder (face-down blanks, no randomness). Host replaces it. */
function placeholderState(): State {
  return {
    cards: Array.from({ length: SIZE }, () => ({ emoji: '', owner: null })),
    flipped: [],
    turn: 'a',
    scores: { a: 0, b: 0 },
    lock: false,
    done: true, // hidden until host seeds — partner gate handles the wait UI
  };
}

export function MemoryMatch() {
  const [state, setState] = useState<State>(placeholderState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const seededRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendRef = useRef<(data: unknown) => void>(() => {});

  const pushState = useCallback((next: State) => {
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  // Host: handle a flip from either player. Validates turn + card state, then
  // resolves a pair (match stays + go again; miss shows briefly then flips back).
  const applyFlip = useCallback(
    (player: 'a' | 'b', index: number) => {
      const s = stateRef.current;
      if (s.done || s.lock) return;
      if (s.turn !== player) return;
      if (index < 0 || index >= s.cards.length) return;
      const target = s.cards[index];
      if (!target || target.owner !== null) return; // already matched / out of range
      if (s.flipped.includes(index)) return; // already showing
      if (s.flipped.length >= 2) return;

      const flipped = [...s.flipped, index];

      if (flipped.length < 2) {
        pushState({ ...s, flipped });
        return;
      }

      // Second card: evaluate the pair.
      const [i, j] = flipped as [number, number];
      const ci = s.cards[i];
      const cj = s.cards[j];
      if (!ci || !cj) return;
      const isMatch = ci.emoji === cj.emoji;

      if (isMatch) {
        const cards = s.cards.slice();
        cards[i] = { ...ci, owner: player };
        cards[j] = { ...cj, owner: player };
        const scores = { ...s.scores, [player]: s.scores[player] + 1 };
        const done = cards.every((c) => c.owner !== null);
        // Matcher goes again (turn stays the same).
        pushState({ ...s, cards, flipped: [], scores, done });
      } else {
        // Show both briefly (locked), then flip back + pass the turn.
        pushState({ ...s, flipped, lock: true });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const cur = stateRef.current;
          pushState({
            ...cur,
            flipped: [],
            lock: false,
            turn: player === 'a' ? 'b' : 'a',
          });
        }, 1000);
      }
    },
    [pushState],
  );

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as { type?: string; state?: State; action?: { flip?: number } };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        sendRef.current({ type: 'sync', state: stateRef.current });
      } else if (msg.type === 'action' && msg.action && typeof msg.action.flip === 'number') {
        applyFlip('b', msg.action.flip);
      } else if (msg.type === 'reset') {
        // Loser (or tie: previous starter's partner) effectively just reshuffles.
        pushState(freshState({ a: 0, b: 0 }));
      }
    },
    [applyFlip, pushState],
  );

  const { role, partnerHere, send } = useGameSession('memory-match', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Host seeds a real shuffled board once.
  useEffect(() => {
    if (role === 'a' && !seededRef.current) {
      seededRef.current = true;
      const seeded = freshState();
      setState(seeded);
      send({ type: 'sync', state: seeded });
    }
  }, [role, send]);

  // Guest announces itself so the host syncs current state.
  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  // Host re-broadcasts whenever the partner (re)joins.
  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      send({ type: 'sync', state: stateRef.current });
    }
  }, [partnerHere, role, send]);

  // Clear any pending mismatch timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="🧠" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const myTurn = state.turn === role && !state.done && !state.lock;

  const onCardClick = (index: number) => {
    const c = state.cards[index];
    if (!c || state.done || state.lock) return;
    if (state.turn !== role) return;
    if (c.owner !== null || state.flipped.includes(index) || state.flipped.length >= 2) return;
    if (role === 'a') applyFlip('a', index);
    else send({ type: 'action', action: { flip: index } });
  };

  const onPlayAgain = () => {
    if (role === 'a') pushState(freshState({ a: 0, b: 0 }));
    else send({ type: 'reset' });
  };

  // Status line
  let status: string;
  let statusTone: 'normal' | 'success' | 'error' | 'muted' = 'normal';
  if (state.done) {
    const mine = state.scores[role];
    const theirs = state.scores[role === 'a' ? 'b' : 'a'];
    if (mine > theirs) {
      status = 'You win! 🎉';
      statusTone = 'success';
    } else if (mine < theirs) {
      status = 'Partner wins';
      statusTone = 'error';
    } else {
      status = "It's a tie";
      statusTone = 'muted';
    }
  } else if (myTurn) {
    status = 'Your turn — find a pair';
    statusTone = 'success';
  } else {
    status = "Partner's turn";
    statusTone = 'muted';
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill label={role === 'a' ? 'You' : 'Partner'} value={state.scores.a} highlight={role === 'a'} />
        <ScorePill label={role === 'b' ? 'You' : 'Partner'} value={state.scores.b} highlight={role === 'b'} />
      </div>

      {/* Status */}
      <p
        className={cn(
          'text-center text-sm font-medium text-text transition-colors',
          statusTone === 'success' && 'text-success',
          statusTone === 'error' && 'text-error',
          statusTone === 'muted' && 'text-text-muted',
        )}
      >
        {status}
        <span className="ml-1.5 text-text-muted">· {PAIRS} pairs</span>
      </p>

      {/* Board */}
      <div className="grid grid-cols-4 gap-2">
        {state.cards.map((card, i) => {
          const faceUp = card.owner !== null || state.flipped.includes(i);
          const matched = card.owner !== null;
          const mineMatch = card.owner === role;
          const playable = myTurn && !faceUp && state.flipped.length < 2;
          return (
            <button
              key={i}
              onClick={() => onCardClick(i)}
              disabled={!playable}
              aria-label={faceUp ? `Card ${card.emoji}` : `Hidden card ${i + 1}`}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-xl border text-2xl transition-all duration-200 sm:text-3xl',
                faceUp ? 'bg-surface' : 'bg-surface-hover',
                matched
                  ? mineMatch
                    ? 'border-success'
                    : 'border-border-focus'
                  : 'border-border',
                playable && 'hover:bg-surface-hover hover:border-border-focus cursor-pointer',
                !playable && 'cursor-default',
                matched && 'opacity-70',
                faceUp && 'scale-[1.02]',
              )}
            >
              {faceUp && card.emoji ? (
                <Emoji emoji={card.emoji} size={30} />
              ) : (
                <Emoji emoji="❔" size={22} className="opacity-40" />
              )}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      {state.done && (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        </div>
      )}
    </div>
  );
}

function ScorePill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors',
        highlight ? 'border-primary bg-surface-hover' : 'border-border bg-surface',
      )}
    >
      <span className="text-xs text-text-muted">{label} · pairs</span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
