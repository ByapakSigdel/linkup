import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'] as const;
const face = (n: number): string =>
  DICE_FACES[Math.min(5, Math.max(0, n - 1))] ?? DICE_FACES[0];

const WIN_TARGET = 5;

/** A roll = two dice per player. */
interface Roll {
  /** Monotonic id so both clients can detect a fresh roll to animate. */
  id: number;
  a: [number, number];
  b: [number, number];
  winner: 'a' | 'b' | 'tie';
}

/** Authoritative state owned by the HOST (role 'a'). */
interface State {
  round: number;
  scores: { a: number; b: number };
  roll: Roll | null;
  matchWinner: 'a' | 'b' | null;
}

function initialState(): State {
  return { round: 1, scores: { a: 0, b: 0 }, roll: null, matchWinner: null };
}

const d6 = () => Math.floor(Math.random() * 6) + 1;
const total = (pair: [number, number]) => pair[0] + pair[1];

export function DiceDuel() {
  const { colors } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Animation: while rolling we show cycling faces, then settle on the real roll.
  const [rolling, setRolling] = useState(false);
  const [tick, setTick] = useState(0);
  const lastRollIdRef = useRef(0);

  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: s });
  }, []);

  /** HOST: generate the dice (only place Math.random is used) and resolve. */
  const doRoll = useCallback(() => {
    const s = stateRef.current;
    if (s.matchWinner) return;

    const a: [number, number] = [d6(), d6()];
    const b: [number, number] = [d6(), d6()];
    const ta = total(a);
    const tb = total(b);
    const winner: 'a' | 'b' | 'tie' = ta === tb ? 'tie' : ta > tb ? 'a' : 'b';

    const scores = { ...s.scores };
    if (winner === 'a') scores.a += 1;
    else if (winner === 'b') scores.b += 1;

    const matchWinner =
      scores.a >= WIN_TARGET ? 'a' : scores.b >= WIN_TARGET ? 'b' : null;

    const next: State = {
      round: winner === 'tie' ? s.round : s.round + 1,
      scores,
      roll: { id: s.round * 1000 + (Date.now() % 1000), a, b, winner },
      matchWinner,
    };
    setState(next);
    broadcast(next);
  }, [broadcast]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as { type?: string; state?: State; action?: { kind?: string } };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        broadcast(stateRef.current);
      } else if (msg.type === 'action' && msg.action?.kind === 'roll') {
        doRoll();
      } else if (msg.type === 'reset') {
        const next = initialState();
        setState(next);
        broadcast(next);
      }
    },
    [doRoll, broadcast],
  );

  const { role, partnerHere, send } = useGameSession('dice-duel', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      broadcast(stateRef.current);
    }
  }, [partnerHere, role, broadcast]);

  // Whenever a brand-new roll lands, run the shake/cycle animation, then settle.
  useEffect(() => {
    if (state.roll && state.roll.id !== lastRollIdRef.current) {
      lastRollIdRef.current = state.roll.id;
      setRolling(true);
      const cycle = setInterval(() => setTick((t) => t + 1), 80);
      const stop = setTimeout(() => {
        clearInterval(cycle);
        setRolling(false);
      }, 700);
      return () => {
        clearInterval(cycle);
        clearTimeout(stop);
      };
    }
  }, [state.roll]);

  const onRoll = () => {
    if (!partnerHere || state.matchWinner || rolling) return;
    if (role === 'a') doRoll();
    else send({ type: 'action', action: { kind: 'roll' } });
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

  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 44 }}>🎲</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const roll = state.roll;
  const myKey = role;
  const partnerKey: 'a' | 'b' = role === 'a' ? 'b' : 'a';
  const myDice = roll ? roll[myKey] : null;
  const partnerDice = roll ? roll[partnerKey] : null;
  const myTotal = myDice ? total(myDice) : null;
  const partnerTotal = partnerDice ? total(partnerDice) : null;

  const roundOutcome: 'win' | 'lose' | 'tie' | null = roll
    ? roll.winner === 'tie'
      ? 'tie'
      : roll.winner === role
        ? 'win'
        : 'lose'
    : null;

  const statusColor =
    !rolling && roundOutcome === 'win'
      ? colors.success
      : !rolling && roundOutcome === 'lose'
        ? colors.error
        : colors.textMuted;

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} target={WIN_TARGET} highlight />
        <ScorePill label="Partner" value={partnerScore} target={WIN_TARGET} />
      </View>

      <AppText center variant="caption" muted>
        {`Round ${state.round} · Higher total wins · First to ${WIN_TARGET}`}
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
            <DiceSide
              who="You"
              dice={myDice}
              sum={rolling ? null : myTotal}
              rolling={rolling}
              tick={tick}
              outcome={!rolling ? roundOutcome : null}
            />
          </View>
          <AppText variant="subtitle" muted>vs</AppText>
          <View style={{ flex: 1 }}>
            <DiceSide
              who="Partner"
              dice={partnerDice}
              sum={rolling ? null : partnerTotal}
              rolling={rolling}
              tick={tick + 1}
              outcome={
                !rolling
                  ? roundOutcome === 'win'
                    ? 'lose'
                    : roundOutcome === 'lose'
                      ? 'win'
                      : roundOutcome
                  : null
              }
            />
          </View>
        </View>

        <AppText center variant="label" style={{ color: statusColor, paddingTop: 4 }}>
          {rolling
            ? 'Rolling…'
            : state.matchWinner
              ? state.matchWinner === role
                ? 'Match won! 🎉'
                : 'Partner won the match'
              : roll
                ? roundOutcome === 'win'
                  ? 'You win the round! 🎉'
                  : roundOutcome === 'lose'
                    ? 'Partner takes the round'
                    : 'Tie — re-roll, no point'
                : 'Roll the dice to begin'}
        </AppText>
      </Card>

      {/* Controls */}
      <View style={{ alignItems: 'center' }}>
        {state.matchWinner ? (
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        ) : (
          <Button variant="primary" onPress={onRoll} disabled={rolling}>
            <AppText style={{ fontSize: 18 }}>🎲</AppText>
            <AppText style={{ color: colors.textOnPrimary, fontWeight: '700', fontSize: 15 }}>
              {roll && roundOutcome === 'tie' ? 'Re-roll' : roll ? 'Roll again' : 'Roll'}
            </AppText>
          </Button>
        )}
      </View>
    </View>
  );
}

function DiceSide({
  who,
  dice,
  sum,
  rolling,
  tick,
  outcome,
}: {
  who: string;
  dice: [number, number] | null;
  sum: number | null;
  rolling: boolean;
  tick: number;
  outcome: 'win' | 'lose' | 'tie' | null;
}) {
  const { colors, radius } = useTheme();
  const showRolling = rolling;
  const faceFor = (slot: number): string => {
    if (showRolling) return face(((tick + slot * 3) % 6) + 1);
    if (dice) return face(dice[slot] ?? 1);
    return DICE_FACES[0];
  };
  const empty = !dice && !rolling;

  const borderColor =
    outcome === 'win' ? colors.success : outcome === 'lose' ? colors.error : colors.border;
  const labelColor =
    outcome === 'win' ? colors.success : outcome === 'lose' ? colors.error : colors.textMuted;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor,
          backgroundColor: outcome === 'win' ? colors.surfaceHover : colors.surface,
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      >
        {[0, 1].map((slot) => (
          <AppText
            key={slot}
            style={{
              fontSize: 46,
              lineHeight: 50,
              color: empty ? colors.textMuted : colors.text,
              opacity: empty ? 0.4 : 1,
            }}
          >
            {empty ? DICE_FACES[0] : faceFor(slot)}
          </AppText>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <AppText variant="caption" style={{ color: labelColor }}>{who}</AppText>
        <AppText variant="label" style={{ minWidth: 24, textAlign: 'center' }}>
          {sum ?? (rolling ? '…' : '–')}
        </AppText>
      </View>
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
