'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

type Cell = 'a' | 'b' | null;

interface State {
  board: Cell[];
  turn: 'a' | 'b';
  winner: 'a' | 'b' | 'draw' | null;
  line: number[] | null;
  scores: { a: number; b: number; draw: number };
}

const LINES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function initialState(): State {
  return {
    board: Array(9).fill(null),
    turn: 'a',
    winner: null,
    line: null,
    scores: { a: 0, b: 0, draw: 0 },
  };
}

function evaluate(board: Cell[]): { winner: 'a' | 'b' | null; line: number[] | null } {
  for (const l of LINES) {
    const [x, y, z] = l;
    if (board[x] && board[x] === board[y] && board[x] === board[z]) {
      return { winner: board[x] as 'a' | 'b', line: [x, y, z] };
    }
  }
  return { winner: null, line: null };
}

/** Mark for a role: role 'a' = X, role 'b' = O */
const MARK: Record<'a' | 'b', string> = { a: '✕', b: '◯' };

export function TicTacToe() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);

  const sendRef = useRef<(data: unknown) => void>(() => {});

  const applyAction = useCallback((index: number, player: 'a' | 'b') => {
    const s = stateRef.current;
    if (s.winner) return;
    if (s.turn !== player) return;
    if (s.board[index] !== null) return;

    const board = s.board.slice();
    board[index] = player;
    const { winner, line } = evaluate(board);
    const full = board.every((c) => c !== null);

    let nextWinner: State['winner'] = null;
    let scores = s.scores;
    if (winner) {
      nextWinner = winner;
      scores = { ...s.scores, [winner]: s.scores[winner] + 1 };
    } else if (full) {
      nextWinner = 'draw';
      scores = { ...s.scores, draw: s.scores.draw + 1 };
    }

    const next: State = {
      board,
      turn: player === 'a' ? 'b' : 'a',
      winner: nextWinner,
      line,
      scores,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as { type?: string; state?: State; action?: { index: number } };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        sendRef.current({ type: 'sync', state: stateRef.current });
      } else if (msg.type === 'action' && msg.action) {
        applyAction(msg.action.index, 'b');
      } else if (msg.type === 'reset') {
        const next: State = { ...initialState(), scores: stateRef.current.scores };
        setState(next);
        sendRef.current({ type: 'sync', state: next });
      }
    },
    [applyAction],
  );

  const { role, partnerHere, send } = useGameSession('tic-tac-toe', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Guest announces itself on mount so the host sends current state.
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

  const myTurn = state.turn === role && !state.winner && partnerHere;

  const onCellClick = (index: number) => {
    if (!partnerHere || state.winner || state.board[index] !== null) return;
    if (state.turn !== role) return;
    if (role === 'a') {
      applyAction(index, 'a');
    } else {
      send({ type: 'action', action: { index } });
    }
  };

  const onPlayAgain = () => {
    if (role === 'a') {
      const next: State = { ...initialState(), scores: state.scores };
      setState(next);
      send({ type: 'sync', state: next });
    } else {
      send({ type: 'reset' });
    }
  };

  let status: string;
  let statusTone: 'normal' | 'success' | 'error' | 'muted' = 'normal';
  if (!state.winner) {
    if (myTurn) {
      status = 'Your turn';
      statusTone = 'success';
    } else {
      status = "Partner's turn";
      statusTone = 'muted';
    }
  } else if (state.winner === 'draw') {
    status = "It's a draw";
    statusTone = 'muted';
  } else if (state.winner === role) {
    status = 'You win! 🎉';
    statusTone = 'success';
  } else {
    status = 'Partner wins';
    statusTone = 'error';
  }

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">⭕</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-3">
        <ScorePill
          label={role === 'a' ? 'You' : 'Partner'}
          mark={MARK.a}
          value={state.scores.a}
          highlight={role === 'a'}
        />
        <ScorePill label="Draws" mark="–" value={state.scores.draw} />
        <ScorePill
          label={role === 'b' ? 'You' : 'Partner'}
          mark={MARK.b}
          value={state.scores.b}
          highlight={role === 'b'}
        />
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
        <span className="ml-1.5 text-text-muted">· You are {MARK[role]}</span>
      </p>

      {/* Board */}
      <div className="grid grid-cols-3 gap-2">
        {state.board.map((cell, i) => {
          const winning = state.line?.includes(i) ?? false;
          const playable = !cell && !state.winner && state.turn === role;
          return (
            <button
              key={i}
              onClick={() => onCellClick(i)}
              disabled={!playable}
              aria-label={`Cell ${i + 1}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-xl border text-4xl font-bold transition-all sm:text-5xl',
                'border-border bg-surface',
                playable && 'hover:bg-surface-hover cursor-pointer',
                !playable && 'cursor-default',
                winning && 'border-success bg-surface-hover',
                cell === 'a' && (winning ? 'text-success' : 'text-primary'),
                cell === 'b' && (winning ? 'text-success' : 'text-accent'),
              )}
            >
              {cell ? MARK[cell] : ''}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      {state.winner && (
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
  mark,
  value,
  highlight,
}: {
  label: string;
  mark: string;
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
      <span className="text-xs text-text-muted">
        {mark} {label}
      </span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
