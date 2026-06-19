'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

const WIN_TARGET = 3; // best of 5
const MIN_DELAY = 1500;
const MAX_DELAY = 4000;

type Phase = 'idle' | 'ready' | 'go' | 'result';

/** A finished round's outcome, owned by the HOST. */
interface RoundResult {
  /** Elapsed reaction ms per player, or null if they jumped the gun / didn't tap. */
  ms: { a: number | null; b: number | null };
  /** Who jumped the gun (tapped before GO), if anyone. */
  early: { a: boolean; b: boolean };
  winner: 'a' | 'b';
}

/** Authoritative state owned by the HOST (role 'a'). */
interface State {
  round: number;
  scores: { a: number; b: number };
  phase: Phase;
  /** Latest finished-round result, shown during the 'result' phase. */
  result: RoundResult | null;
  matchWinner: 'a' | 'b' | null;
  /** Bumps every GO so clients can detect a fresh go signal. */
  goNonce: number;
}

function initialState(): State {
  return {
    round: 1,
    scores: { a: 0, b: 0 },
    phase: 'idle',
    result: null,
    matchWinner: null,
    goNonce: 0,
  };
}

export function ReactionDuel() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // HOST-only: pending taps for the current round, and the scheduled GO timer.
  const tapsRef = useRef<{ a: number | null | 'early'; b: number | null | 'early' }>({
    a: null,
    b: null,
  });
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-client: timestamp (performance.now) when THIS client received the GO.
  const goReceiptRef = useRef<number | null>(null);
  // Whether this client already locked a tap this round.
  const tappedRef = useRef(false);

  const clearGoTimer = useCallback(() => {
    if (goTimerRef.current) {
      clearTimeout(goTimerRef.current);
      goTimerRef.current = null;
    }
  }, []);

  /**
   * HOST: try to resolve the current round.
   * - An early tap ends the round immediately: the early tapper loses without
   *   waiting for the opponent (jumping the gun is an instant forfeit).
   * - Otherwise we wait until BOTH valid (post-GO) taps are in, then the lower
   *   elapsed wins.
   */
  const resolveRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'ready' && s.phase !== 'go') return;
    if (s.matchWinner) return;
    const taps = tapsRef.current;

    const aEarly = taps.a === 'early';
    const bEarly = taps.b === 'early';
    const anyEarly = aEarly || bEarly;

    // Without an early forfeit we must wait for both taps before scoring.
    if (!anyEarly && (taps.a === null || taps.b === null)) return;

    const aMs = aEarly || taps.a === null ? null : (taps.a as number);
    const bMs = bEarly || taps.b === null ? null : (taps.b as number);

    let winner: 'a' | 'b';
    if (aEarly && bEarly) {
      // Both jumped the gun — a double-fault. We still need a winner for the
      // best-of-5 tally, so use the host's goNonce parity as a deterministic,
      // bias-free coin flip that both clients can agree on.
      winner = s.goNonce % 2 === 0 ? 'a' : 'b';
    } else if (aEarly) {
      winner = 'b';
    } else if (bEarly) {
      winner = 'a';
    } else {
      // Both valid — lower elapsed wins; tie -> host edge to 'a'.
      winner = (aMs as number) <= (bMs as number) ? 'a' : 'b';
    }

    // An early forfeit cancels the still-pending GO timer.
    clearGoTimer();

    const scores = { ...s.scores };
    scores[winner] += 1;
    const matchWinner =
      scores.a >= WIN_TARGET ? 'a' : scores.b >= WIN_TARGET ? 'b' : null;

    const next: State = {
      ...s,
      phase: 'result',
      scores,
      result: { ms: { a: aMs, b: bMs }, early: { a: aEarly, b: bEarly }, winner },
      matchWinner,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, [clearGoTimer]);

  /** HOST: record a tap (or early tap) for a player and try to resolve. */
  const applyTap = useCallback(
    (player: 'a' | 'b', payload: { elapsed?: number; early?: boolean }) => {
      const s = stateRef.current;
      if (s.matchWinner) return;
      // Taps only matter once a round is live: 'ready' (only early taps) or 'go'.
      if (s.phase !== 'ready' && s.phase !== 'go') return;
      if (payload.early) {
        // An early tap is only meaningful while still waiting for GO.
        if (s.phase !== 'ready') return;
      } else if (s.phase !== 'go') {
        // A timed tap is only valid after GO fires.
        return;
      }
      if (tapsRef.current[player] !== null) return; // already tapped

      tapsRef.current[player] = payload.early
        ? 'early'
        : typeof payload.elapsed === 'number'
          ? Math.max(0, Math.round(payload.elapsed))
          : 'early';
      resolveRound();
    },
    [resolveRound],
  );

  /** HOST: begin a round — go to 'ready', then schedule the simultaneous GO. */
  const startRound = useCallback(() => {
    const s = stateRef.current;
    if (s.matchWinner) return;
    if (s.phase === 'ready' || s.phase === 'go') return;
    if (!partnerHereRef.current) return;

    clearGoTimer();
    tapsRef.current = { a: null, b: null };

    const ready: State = { ...s, phase: 'ready', result: null };
    setState(ready);
    sendRef.current({ type: 'sync', state: ready });

    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    goTimerRef.current = setTimeout(() => {
      const cur = stateRef.current;
      if (cur.phase !== 'ready' || cur.matchWinner) return;
      goReceiptRef.current = performance.now(); // host stamps its own receipt
      tappedRef.current = false;
      const live: State = { ...cur, phase: 'go', goNonce: cur.goNonce + 1 };
      setState(live);
      sendRef.current({ type: 'sync', state: live });
      sendRef.current({ type: 'go' }); // explicit GO so guest stamps receipt now
    }, delay);
  }, [clearGoTimer]);

  /** HOST: advance to the next round after a result. */
  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'result' || s.matchWinner) return;
    clearGoTimer();
    tapsRef.current = { a: null, b: null };
    const next: State = {
      ...s,
      round: s.round + 1,
      phase: 'idle',
      result: null,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, [clearGoTimer]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind?: 'start' | 'next'; elapsed?: number; early?: boolean };
      };
      const role = roleRef.current;

      if (role === 'b') {
        // GUEST: render from sync; stamp receipt on explicit GO.
        if (msg.type === 'go') {
          goReceiptRef.current = performance.now();
          tappedRef.current = false;
        } else if (msg.type === 'sync' && msg.state) {
          setState(msg.state);
        }
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        sendRef.current({ type: 'sync', state: stateRef.current });
      } else if (msg.type === 'action' && msg.action) {
        if (msg.action.kind === 'start') startRound();
        else if (msg.action.kind === 'next') nextRound();
        else applyTap('b', { elapsed: msg.action.elapsed, early: msg.action.early });
      } else if (msg.type === 'reset') {
        clearGoTimer();
        tapsRef.current = { a: null, b: null };
        const next = initialState();
        setState(next);
        sendRef.current({ type: 'sync', state: next });
      }
    },
    [startRound, nextRound, applyTap, clearGoTimer],
  );

  const { role, partnerHere, send } = useGameSession('reaction-duel', handleMessage);
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
      send({ type: 'sync', state: stateRef.current });
    }
  }, [partnerHere, role, send]);

  // Clean up any pending GO timer on unmount.
  useEffect(() => clearGoTimer, [clearGoTimer]);

  // --- Local action helpers ---------------------------------------------

  const onStart = useCallback(() => {
    if (!partnerHere || state.matchWinner) return;
    if (state.phase === 'ready' || state.phase === 'go') return;
    if (role === 'a') startRound();
    else send({ type: 'action', action: { kind: 'start' } });
  }, [partnerHere, state.matchWinner, state.phase, role, startRound, send]);

  const onNext = useCallback(() => {
    if (role === 'a') nextRound();
    else send({ type: 'action', action: { kind: 'next' } });
  }, [role, nextRound, send]);

  const onPlayAgain = useCallback(() => {
    if (role === 'a') {
      clearGoTimer();
      tapsRef.current = { a: null, b: null };
      const next = initialState();
      setState(next);
      send({ type: 'sync', state: next });
    } else {
      send({ type: 'reset' });
    }
  }, [role, send, clearGoTimer]);

  const reportTap = useCallback(
    (payload: { elapsed?: number; early?: boolean }) => {
      if (role === 'a') applyTap('a', payload);
      else send({ type: 'action', action: payload });
    },
    [role, applyTap, send],
  );

  const onTap = useCallback(() => {
    if (state.matchWinner || state.phase === 'idle' || state.phase === 'result') return;
    if (tappedRef.current) return;
    tappedRef.current = true;

    if (state.phase === 'ready') {
      // Jumped the gun.
      reportTap({ early: true });
      return;
    }
    // phase === 'go'
    const receipt = goReceiptRef.current;
    const elapsed = receipt === null ? 0 : Math.max(0, performance.now() - receipt);
    reportTap({ elapsed });
  }, [state.matchWinner, state.phase, reportTap]);

  // --- Derived view ------------------------------------------------------

  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];
  const other = role === 'a' ? 'b' : 'a';

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="⚡" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const r = state.result;
  const myMs = r ? r.ms[role] : null;
  const partnerMs = r ? r.ms[other] : null;
  const myEarly = r ? r.early[role] : false;
  const partnerEarly = r ? r.early[other] : false;
  const roundOutcome: 'win' | 'lose' | null = r ? (r.winner === role ? 'win' : 'lose') : null;

  // Big-panel appearance depends on phase.
  const isGo = state.phase === 'go';
  const isReady = state.phase === 'ready';

  let arenaLabel: string;
  if (state.phase === 'idle') arenaLabel = 'Tap “Start round” when ready';
  else if (isReady) arenaLabel = 'Get ready…';
  else if (isGo) arenaLabel = 'GO!';
  else arenaLabel = roundOutcome === 'win' ? 'You win the round! 🎉' : 'Partner takes the round';

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

      {/* Arena / big tap target */}
      <button
        type="button"
        onClick={onTap}
        disabled={state.phase === 'idle' || state.phase === 'result' || !!state.matchWinner}
        aria-label={isGo ? 'Tap now!' : isReady ? 'Wait for GO' : 'Reaction arena'}
        className={cn(
          'relative flex min-h-44 w-full select-none flex-col items-center justify-center gap-2 rounded-3xl border text-center transition-all duration-150',
          isGo && 'border-success bg-success text-text-on-primary scale-[1.01] shadow-lg cursor-pointer',
          isReady && 'border-secondary bg-secondary/15 text-secondary cursor-pointer',
          state.phase === 'idle' && 'border-border bg-surface text-text-muted cursor-default',
          state.phase === 'result' && 'border-border bg-surface cursor-default',
        )}
      >
        {state.phase === 'result' && r ? (
          <div className="flex flex-col items-center gap-2 px-4">
            <span
              className={cn(
                'text-2xl font-bold',
                roundOutcome === 'win' ? 'text-success' : 'text-error',
              )}
            >
              {arenaLabel}
            </span>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <span className="text-text-muted">You</span>
              <span className="text-text-muted">Partner</span>
              <span className={cn('font-semibold', myEarly ? 'text-error' : 'text-text')}>
                {myEarly ? 'Too soon! 🫣' : `${myMs ?? '—'} ms`}
              </span>
              <span
                className={cn('font-semibold', partnerEarly ? 'text-error' : 'text-text')}
              >
                {partnerEarly ? 'Too soon! 🫣' : `${partnerMs ?? '—'} ms`}
              </span>
            </div>
          </div>
        ) : (
          <>
            {isGo && <Emoji emoji="⚡" size={48} />}
            <span
              className={cn(
                'font-bold tracking-wide',
                isGo ? 'text-4xl' : 'text-xl',
              )}
            >
              {arenaLabel}
            </span>
            {isReady && (
              <span className="text-xs font-medium text-text-muted">
                Don’t tap until it flashes GO
              </span>
            )}
          </>
        )}
      </button>

      {/* Controls */}
      {state.matchWinner ? (
        <div className="flex flex-col items-center gap-3">
          <p
            className={cn(
              'text-center text-sm font-semibold',
              state.matchWinner === role ? 'text-success' : 'text-error',
            )}
          >
            {state.matchWinner === role ? 'Match won! 🎉' : 'Partner won the match'}
          </p>
          <Button variant="primary" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        </div>
      ) : state.phase === 'result' ? (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onNext}>
            Next round
          </Button>
        </div>
      ) : state.phase === 'idle' ? (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onStart}>
            Start round
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm font-medium text-text-muted">
          {isGo ? 'Tap the panel — fast!' : 'Steady… wait for GO'}
        </p>
      )}
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
