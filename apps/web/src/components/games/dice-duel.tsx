'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

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
      roll: { id: s.round * 1000 + Date.now() % 1000, a, b, winner },
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
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="🎲" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
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

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill label="You" value={myScore} target={WIN_TARGET} highlight />
        <ScorePill label="Partner" value={partnerScore} target={WIN_TARGET} />
      </div>

      <p className="text-center text-sm text-text-muted">
        Round {state.round} · Higher total wins · First to {WIN_TARGET}
      </p>

      {/* Arena */}
      <Card cardStyle="elevated">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
          <DiceSide
            who="You"
            dice={myDice}
            sum={rolling ? null : myTotal}
            rolling={rolling}
            tick={tick}
            outcome={!rolling ? roundOutcome : null}
          />
          <span className="select-none text-center text-lg font-semibold text-text-muted">
            vs
          </span>
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
        </div>

        <p
          className={cn(
            'pt-1 text-center text-sm font-medium transition-colors',
            !rolling && roundOutcome === 'win' && 'text-success',
            !rolling && roundOutcome === 'lose' && 'text-error',
            (rolling || roundOutcome === 'tie' || roundOutcome === null) &&
              'text-text-muted',
          )}
        >
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
                    : "Tie — re-roll, no point"
                : 'Roll the dice to begin'}
        </p>
      </Card>

      {/* Controls */}
      <div className="flex justify-center">
        {state.matchWinner ? (
          <Button variant="primary" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        ) : (
          <Button
            variant="primary"
            shape="pill"
            onClick={onRoll}
            disabled={rolling}
          >
            <Emoji emoji="🎲" size={18} />
            {roll && roundOutcome === 'tie' ? 'Re-roll' : roll ? 'Roll again' : 'Roll'}
          </Button>
        )}
      </div>
    </div>
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
  // While rolling, cycle pseudo-random faces driven by the parent's tick so
  // SSR/first render is deterministic (no Math.random in render).
  const showRolling = rolling;
  const faceFor = (slot: number): string => {
    if (showRolling) return face(((tick + slot * 3) % 6) + 1);
    if (dice) return face(dice[slot] ?? 1);
    return DICE_FACES[0];
  };
  const empty = !dice && !rolling;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 transition-all duration-300',
          outcome === 'win' && 'border-success bg-surface-hover',
          outcome === 'lose' && 'border-error',
          (outcome === 'tie' || outcome === null) && 'border-border bg-surface',
        )}
      >
        {[0, 1].map((slot) => (
          <span
            key={slot}
            className={cn(
              'inline-flex text-5xl leading-none transition-transform duration-150',
              showRolling && 'animate-pulse',
              empty && 'text-text-muted opacity-40',
            )}
            aria-hidden
          >
            {empty ? DICE_FACES[0] : faceFor(slot)}
          </span>
        ))}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-xs font-medium',
            outcome === 'win'
              ? 'text-success'
              : outcome === 'lose'
                ? 'text-error'
                : 'text-text-muted',
          )}
        >
          {who}
        </span>
        <span className="min-w-[1.5rem] text-center text-sm font-bold text-text">
          {sum ?? (rolling ? '…' : '–')}
        </span>
      </div>
    </div>
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
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors',
        highlight ? 'border-primary bg-surface-hover' : 'border-border bg-surface',
      )}
    >
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xl font-bold text-text">
        {value}
        <span className="text-sm font-normal text-text-muted"> / {target}</span>
      </span>
    </div>
  );
}
