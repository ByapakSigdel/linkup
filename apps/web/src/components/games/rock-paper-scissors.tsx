'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

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
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Brief "reveal" flash when a fresh result arrives.
  const [flash, setFlash] = useState(false);
  const lastRevealRef = useRef<State['reveal']>(null);

  /** HOST: record a player's secret pick and resolve the round if both are in. */
  const applyPick = useCallback((player: 'a' | 'b', move: Move) => {
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
  }, []);

  /** HOST helper: send each side its own filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

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

  const { role, partnerHere, send } = useGameSession(
    'rock-paper-scissors',
    handleMessage,
  );
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

  // My own pick is always known to me locally (host has it; guest sent it).
  const myPick: Move | null = state.picks[role] ?? null;
  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="✊" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const r = state.reveal;
  const myReveal: Move | null = r ? r[role] : null;
  const partnerReveal: Move | null = r ? r[role === 'a' ? 'b' : 'a'] : null;
  const roundOutcome: 'win' | 'lose' | 'tie' | null = r
    ? r.winner === 'tie'
      ? 'tie'
      : r.winner === role
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
        Round {state.round} · First to {WIN_TARGET} wins · Best of 5
      </p>

      {/* Arena */}
      <Card cardStyle="elevated" className="overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
          <Hand
            who="You"
            move={r ? myReveal : myPick}
            revealed={!!r}
            picked={!!myPick}
            outcome={
              roundOutcome === 'win'
                ? 'win'
                : roundOutcome === 'lose'
                  ? 'lose'
                  : roundOutcome === 'tie'
                    ? 'tie'
                    : null
            }
            flash={flash}
          />
          <span className="select-none text-center text-lg font-semibold text-text-muted">
            vs
          </span>
          <Hand
            who="Partner"
            move={r ? partnerReveal : null}
            revealed={!!r}
            picked={!!state.picks[role === 'a' ? 'b' : 'a'] && !r ? true : !!r}
            outcome={
              roundOutcome === 'win'
                ? 'lose'
                : roundOutcome === 'lose'
                  ? 'win'
                  : roundOutcome === 'tie'
                    ? 'tie'
                    : null
            }
            flash={flash}
            mirror
          />
        </div>

        {/* Result / round status line */}
        <p
          className={cn(
            'pt-1 text-center text-sm font-medium transition-colors',
            roundOutcome === 'win' && 'text-success',
            roundOutcome === 'lose' && 'text-error',
            (roundOutcome === 'tie' || roundOutcome === null) && 'text-text-muted',
          )}
        >
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
        </p>
      </Card>

      {/* Controls */}
      {state.matchWinner ? (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        </div>
      ) : r ? (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onNext}>
            Next round
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {MOVES.map((m) => {
            const selected = myPick === m.id;
            const locked = !!myPick;
            return (
              <button
                key={m.id}
                onClick={() => onPick(m.id)}
                disabled={locked}
                aria-label={m.label}
                aria-pressed={selected}
                className={cn(
                  'flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border transition-all',
                  selected
                    ? 'border-primary bg-surface-hover scale-[1.03] shadow-md'
                    : 'border-border bg-surface',
                  !locked && 'hover:bg-surface-hover hover:-translate-y-0.5 cursor-pointer',
                  locked && !selected && 'opacity-40 cursor-default',
                )}
              >
                <Emoji emoji={m.emoji} size={40} />
                <span
                  className={cn(
                    'text-xs font-medium',
                    selected ? 'text-primary' : 'text-text-muted',
                  )}
                >
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Hand({
  who,
  move,
  revealed,
  picked,
  outcome,
  flash,
  mirror,
}: {
  who: string;
  move: Move | null;
  revealed: boolean;
  picked: boolean;
  outcome: 'win' | 'lose' | 'tie' | null;
  flash?: boolean;
  mirror?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex h-24 w-24 items-center justify-center rounded-2xl border transition-all duration-300',
          outcome === 'win' && 'border-success bg-surface-hover',
          outcome === 'lose' && 'border-error',
          (outcome === 'tie' || outcome === null) && 'border-border bg-surface',
          flash && revealed && 'scale-105',
        )}
      >
        <span
          className={cn(
            'inline-flex transition-all duration-300',
            mirror && '-scale-x-100',
            revealed ? 'opacity-100 scale-100' : 'opacity-90',
          )}
        >
          {revealed && move ? (
            <Emoji emoji={EMOJI[move]} size={52} />
          ) : picked ? (
            <span className="text-4xl font-bold text-primary">✓</span>
          ) : (
            <span className="text-4xl text-text-muted">·</span>
          )}
        </span>
      </div>
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
