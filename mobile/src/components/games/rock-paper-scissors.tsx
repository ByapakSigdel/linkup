import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

type Move = 'rock' | 'paper' | 'scissors';

const MOVES: { id: Move; emoji: string; label: string }[] = [
  { id: 'rock', emoji: '✊', label: 'Rock' },
  { id: 'paper', emoji: '✋', label: 'Paper' },
  { id: 'scissors', emoji: '✌️', label: 'Scissors' },
];

const EMOJI: Record<Move, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};

const WIN_TARGET = 3; // best of 5

/** Authoritative state owned by the HOST (role 'a'). */
interface State {
  round: number;
  scores: { a: number; b: number };
  /** Secret picks for the current round; never include both until both are in. */
  picks: { a: Move | null; b: Move | null };
  /** When both have picked, the resolved round result is published here. */
  reveal: { a: Move; b: Move; winner: 'a' | 'b' | 'tie' } | null;
  /** Match winner once someone reaches WIN_TARGET. */
  matchWinner: 'a' | 'b' | null;
}

function initialState(): State {
  return {
    round: 1,
    scores: { a: 0, b: 0 },
    picks: { a: null, b: null },
    reveal: null,
    matchWinner: null,
  };
}

/** Does move x beat move y? */
function beats(x: Move, y: Move): boolean {
  return (
    (x === 'rock' && y === 'scissors') ||
    (x === 'paper' && y === 'rock') ||
    (x === 'scissors' && y === 'paper')
  );
}

/**
 * What the GUEST is allowed to see. The host strips the partner's secret pick
 * until both players have submitted, so a peeking client can't learn it early.
 */
function publicView(s: State, viewer: 'a' | 'b'): State {
  if (s.reveal) return s; // both in — safe to show everything
  const other = viewer === 'a' ? 'b' : 'a';
  return {
    ...s,
    picks: { ...s.picks, [other]: s.picks[other] ? ('__hidden__' as Move) : null },
  };
}

export function RockPaperScissors() {
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Brief "reveal" flash when a fresh result arrives.
  const [flash, setFlash] = useState(false);
  const lastRevealRef = useRef<State['reveal']>(null);

  /** HOST helper: send each side its own filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

  /** HOST: record a player's secret pick and resolve the round if both are in. */
  const applyPick = useCallback(
    (player: 'a' | 'b', move: Move) => {
      const s = stateRef.current;
      if (s.matchWinner) return;
      if (s.reveal) return; // round already resolved, waiting for next
      if (s.picks[player]) return; // already picked this round

      const picks = { ...s.picks, [player]: move };

      let next: State;
      if (picks.a && picks.b) {
        const a = picks.a;
        const b = picks.b;
        let winner: 'a' | 'b' | 'tie';
        if (a === b) winner = 'tie';
        else winner = beats(a, b) ? 'a' : 'b';

        const scores = { ...s.scores };
        if (winner === 'a') scores.a += 1;
        else if (winner === 'b') scores.b += 1;

        const matchWinner =
          scores.a >= WIN_TARGET ? 'a' : scores.b >= WIN_TARGET ? 'b' : null;

        next = { ...s, picks, scores, reveal: { a, b, winner }, matchWinner };
      } else {
        next = { ...s, picks };
      }

      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: advance to the next round after a reveal. */
  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (!s.reveal || s.matchWinner) return;
    const next: State = {
      ...s,
      round: s.round + 1,
      picks: { a: null, b: null },
      reveal: null,
    };
    setState(next);
    broadcast(next);
  }, [broadcast]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { move?: Move; kind?: 'next' };
      };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        broadcast(stateRef.current);
      } else if (msg.type === 'action' && msg.action) {
        if (msg.action.kind === 'next') nextRound();
        else if (msg.action.move) applyPick('b', msg.action.move);
      } else if (msg.type === 'reset') {
        const next = initialState();
        setState(next);
        broadcast(next);
      }
    },
    [applyPick, nextRound, broadcast],
  );

  const { role, partnerHere, send } = useGameSession('rock-paper-scissors', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Guest announces itself so the host sends current state.
  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  // Host re-broadcasts whenever the partner (re)joins.
  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      broadcast(stateRef.current);
    }
  }, [partnerHere, role, broadcast]);

  // Flash the reveal whenever a new round result lands.
  useEffect(() => {
    if (state.reveal && state.reveal !== lastRevealRef.current) {
      lastRevealRef.current = state.reveal;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
    if (!state.reveal) lastRevealRef.current = null;
  }, [state.reveal]);

  // My own pick is always known to me locally (host has it; guest sent it).
  const myPick: Move | null = state.picks[role] ?? null;
  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];

  const onPick = (move: Move) => {
    if (!partnerHere || state.matchWinner || state.reveal) return;
    if (myPick) return;
    if (role === 'a') applyPick('a', move);
    else send({ type: 'action', action: { move } });
  };

  const onNext = () => {
    if (role === 'a') nextRound();
    else send({ type: 'action', action: { kind: 'next' } });
  };

  const onPlayAgain = () => {
    if (role === 'a') {
      const next = initialState();
      setState(next);
      broadcast(next);
    } else {
      send({ type: 'reset' });
    }
  };

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 44 }}>✊</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const r = state.reveal;
  const myReveal: Move | null = r ? r[role] : null;
  const partnerReveal: Move | null = r ? r[role === 'a' ? 'b' : 'a'] : null;
  const partnerPicked = !!state.picks[role === 'a' ? 'b' : 'a'];
  const roundOutcome: 'win' | 'lose' | 'tie' | null = r
    ? r.winner === 'tie'
      ? 'tie'
      : r.winner === role
        ? 'win'
        : 'lose'
    : null;

  const resultColor =
    roundOutcome === 'win' ? colors.success : roundOutcome === 'lose' ? colors.error : colors.textMuted;

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} target={WIN_TARGET} highlight />
        <ScorePill label="Partner" value={partnerScore} target={WIN_TARGET} />
      </View>

      <AppText center variant="caption" muted>
        {`Round ${state.round} · First to ${WIN_TARGET} wins · Best of 5`}
      </AppText>

      {/* Arena */}
      <Card variant="elevated">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingVertical: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Hand
              who="You"
              move={r ? myReveal : myPick}
              revealed={!!r}
              picked={!!myPick}
              outcome={roundOutcome}
              flash={flash}
            />
          </View>
          <AppText variant="subtitle" muted>vs</AppText>
          <View style={{ flex: 1 }}>
            <Hand
              who="Partner"
              move={r ? partnerReveal : null}
              revealed={!!r}
              picked={!r ? partnerPicked : true}
              outcome={
                roundOutcome === 'win'
                  ? 'lose'
                  : roundOutcome === 'lose'
                    ? 'win'
                    : roundOutcome
              }
              flash={flash}
            />
          </View>
        </View>

        {/* Result / round status line */}
        <AppText center variant="label" style={{ color: resultColor, paddingTop: 4 }}>
          {state.matchWinner
            ? state.matchWinner === role
              ? 'Match won! 🎉'
              : 'Partner won the match'
            : r
              ? roundOutcome === 'win'
                ? 'You win the round! 🎉'
                : roundOutcome === 'lose'
                  ? 'Partner takes the round'
                  : "It's a tie — no point"
              : myPick
                ? 'Locked in · waiting for partner…'
                : 'Make your move'}
        </AppText>
      </Card>

      {/* Controls */}
      {state.matchWinner ? (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        </View>
      ) : r ? (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onNext} label="Next round" />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {MOVES.map((m) => {
            const selected = myPick === m.id;
            const locked = !!myPick;
            return (
              <Pressable
                key={m.id}
                onPress={() => onPick(m.id)}
                disabled={locked}
                style={({ pressed }) => ({
                  flex: 1,
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor:
                    selected || (pressed && !locked) ? colors.surfaceHover : colors.surface,
                  opacity: locked && !selected ? 0.4 : 1,
                })}
              >
                <AppText style={{ fontSize: 40 }}>{m.emoji}</AppText>
                <AppText
                  variant="caption"
                  style={{ color: selected ? colors.primary : colors.textMuted }}
                >
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function Hand({
  who,
  move,
  revealed,
  picked,
  outcome,
  flash,
}: {
  who: string;
  move: Move | null;
  revealed: boolean;
  picked: boolean;
  outcome: 'win' | 'lose' | 'tie' | null;
  flash?: boolean;
}) {
  const { colors, radius } = useTheme();
  const borderColor =
    outcome === 'win' ? colors.success : outcome === 'lose' ? colors.error : colors.border;
  const labelColor =
    outcome === 'win' ? colors.success : outcome === 'lose' ? colors.error : colors.textMuted;
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View
        style={{
          height: 92,
          width: 92,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor,
          backgroundColor: outcome === 'win' && flash ? colors.surfaceHover : colors.surface,
        }}
      >
        {revealed && move ? (
          <AppText style={{ fontSize: 50 }}>{EMOJI[move]}</AppText>
        ) : picked ? (
          <AppText style={{ fontSize: 36, fontWeight: '800', color: colors.primary }}>✓</AppText>
        ) : (
          <AppText style={{ fontSize: 36, color: colors.textMuted }}>·</AppText>
        )}
      </View>
      <AppText variant="caption" style={{ color: labelColor }}>{who}</AppText>
    </View>
  );
}

function ScorePill({
  label,
  value,
  target,
  highlight,
}: {
  label: string;
  value: number;
  target: number;
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
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="title">
        {value}
        <AppText variant="caption" muted>{` / ${target}`}</AppText>
      </AppText>
    </View>
  );
}
