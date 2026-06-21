import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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

/** Host-only: build a fresh shuffled board (Math.random — never in render). */
function freshState(
  scores: { a: number; b: number } = { a: 0, b: 0 },
  starter: 'a' | 'b' = 'a',
): State {
  const picks = shuffle([...POOL]).slice(0, PAIRS);
  const deck = shuffle([...picks, ...picks]).map((emoji) => ({
    emoji,
    owner: null as 'a' | 'b' | null,
  }));
  return {
    cards: deck,
    flipped: [],
    turn: starter,
    scores,
    lock: false,
    done: false,
  };
}

/** Safe placeholder (face-down blanks, no randomness). Host replaces it. */
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
  const { colors, radius } = useTheme();
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
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 44 }}>🧠</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
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
  let statusColor = colors.text;
  if (state.done) {
    const mine = state.scores[role];
    const theirs = state.scores[role === 'a' ? 'b' : 'a'];
    if (mine > theirs) {
      status = 'You win! 🎉';
      statusColor = colors.success;
    } else if (mine < theirs) {
      status = 'Partner wins';
      statusColor = colors.error;
    } else {
      status = "It's a tie";
      statusColor = colors.textMuted;
    }
  } else if (myTurn) {
    status = 'Your turn — find a pair';
    statusColor = colors.success;
  } else {
    status = "Partner's turn";
    statusColor = colors.textMuted;
  }

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill
          label={role === 'a' ? 'You' : 'Partner'}
          value={state.scores.a}
          highlight={role === 'a'}
        />
        <ScorePill
          label={role === 'b' ? 'You' : 'Partner'}
          value={state.scores.b}
          highlight={role === 'b'}
        />
      </View>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>
        {status}
        <AppText variant="label" color={colors.textMuted}>{`  · ${PAIRS} pairs`}</AppText>
      </AppText>

      {/* Board */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {state.cards.map((card, i) => {
          const faceUp = card.owner !== null || state.flipped.includes(i);
          const matched = card.owner !== null;
          const mineMatch = card.owner === role;
          const playable = myTurn && !faceUp && state.flipped.length < 2;
          const borderColor = matched
            ? mineMatch
              ? colors.success
              : colors.borderFocus
            : colors.border;
          return (
            <Pressable
              key={i}
              onPress={() => onCardClick(i)}
              disabled={!playable}
              style={({ pressed }) => ({
                width: '22%',
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor,
                backgroundColor: faceUp
                  ? colors.surface
                  : pressed && playable
                    ? colors.surface
                    : colors.surfaceHover,
                opacity: matched ? 0.7 : 1,
              })}
            >
              {faceUp && card.emoji ? (
                <AppText style={{ fontSize: 28 }}>{card.emoji}</AppText>
              ) : (
                <AppText style={{ fontSize: 20, opacity: 0.4 }}>❔</AppText>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Controls */}
      {state.done && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        </View>
      )}
    </View>
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
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        borderRadius: radius.card,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderColor: highlight ? colors.primary : colors.border,
        backgroundColor: highlight ? colors.surfaceHover : colors.surface,
      }}
    >
      <AppText variant="caption" muted>{`${label} · pairs`}</AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
