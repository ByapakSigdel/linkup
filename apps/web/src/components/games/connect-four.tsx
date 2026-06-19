'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

type Cell = 'a' | 'b' | null;

const COLS = 7;
const ROWS = 6;

interface State {
  /** Row-major board: index = row * COLS + col (row 0 = top). */
  board: Cell[];
  turn: 'a' | 'b';
  winner: 'a' | 'b' | 'draw' | null;
  line: number[] | null;
  scores: { a: number; b: number; draw: number };
}

function initialState(): State {
  return {
    board: Array(COLS * ROWS).fill(null),
    turn: 'a',
    winner: null,
    line: null,
    scores: { a: 0, b: 0, draw: 0 },
  };
}

const idx = (r: number, c: number) => r * COLS + c;

/** Lowest empty row in a column, or -1 if full. */
function dropRow(board: Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[idx(r, col)] === null) return r;
  }
  return -1;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↙
];

function findWin(board: Cell[], r: number, c: number, player: 'a' | 'b'): number[] | null {
  for (const [dr, dc] of DIRS) {
    const cells = [idx(r, c)];
    // forward
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[idx(nr, nc)] === player) {
      cells.push(idx(nr, nc));
      nr += dr;
      nc += dc;
    }
    // backward
    nr = r - dr;
    nc = c - dc;
    while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[idx(nr, nc)] === player) {
      cells.unshift(idx(nr, nc));
      nr -= dr;
      nc -= dc;
    }
    if (cells.length >= 4) return cells.slice(0, 4);
  }
  return null;
}

export function ConnectFour() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  const applyAction = useCallback((col: number, player: 'a' | 'b') => {
    const s = stateRef.current;
    if (s.winner) return;
    if (s.turn !== player) return;
    if (col < 0 || col >= COLS) return;
    const r = dropRow(s.board, col);
    if (r < 0) return;

    const board = s.board.slice();
    board[idx(r, col)] = player;
    const line = findWin(board, r, col, player);
    const full = board.every((cell) => cell !== null);

    let nextWinner: State['winner'] = null;
    let scores = s.scores;
    if (line) {
      nextWinner = player;
      scores = { ...s.scores, [player]: s.scores[player] + 1 };
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
      const msg = data as { type?: string; state?: State; action?: { col: number } };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        sendRef.current({ type: 'sync', state: stateRef.current });
      } else if (msg.type === 'action' && msg.action) {
        applyAction(msg.action.col, 'b');
      } else if (msg.type === 'reset') {
        const next: State = { ...initialState(), scores: stateRef.current.scores };
        setState(next);
        sendRef.current({ type: 'sync', state: next });
      }
    },
    [applyAction],
  );

  const { role, partnerHere, send } = useGameSession('connect-four', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      send({ type: 'sync', state: stateRef.current });
    }
  }, [partnerHere, role, send]);

  const myTurn = state.turn === role && !state.winner && partnerHere;

  const onColClick = (col: number) => {
    if (!partnerHere || state.winner) return;
    if (state.turn !== role) return;
    if (dropRow(state.board, col) < 0) return;
    if (role === 'a') {
      applyAction(col, 'a');
    } else {
      send({ type: 'action', action: { col } });
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
          <span className="text-4xl">🔵</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const myDiscDot = role === 'a' ? 'bg-primary' : 'bg-secondary';
  const partnerDiscDot = role === 'a' ? 'bg-secondary' : 'bg-primary';

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-3">
        <ScorePill
          label={role === 'a' ? 'You' : 'Partner'}
          dot="bg-primary"
          value={state.scores.a}
          highlight={role === 'a'}
        />
        <ScorePill label="Draws" dot="bg-text-muted" value={state.scores.draw} />
        <ScorePill
          label={role === 'b' ? 'You' : 'Partner'}
          dot="bg-secondary"
          value={state.scores.b}
          highlight={role === 'b'}
        />
      </div>

      {/* Status */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <p
          className={cn(
            'font-medium text-text transition-colors',
            statusTone === 'success' && 'text-success',
            statusTone === 'error' && 'text-error',
            statusTone === 'muted' && 'text-text-muted',
          )}
        >
          {status}
        </p>
        <span className="flex items-center gap-1 text-text-muted">
          · you
          <span className={cn('inline-block h-3 w-3 rounded-full', myDiscDot)} />
        </span>
      </div>

      {/* Board */}
      <div className="rounded-2xl border border-border bg-surface p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: COLS }).map((_, c) => {
            const colFull = dropRow(state.board, c) < 0;
            const clickable = !state.winner && state.turn === role && !colFull;
            return (
              <button
                key={c}
                onClick={() => onColClick(c)}
                disabled={!clickable}
                aria-label={`Drop in column ${c + 1}`}
                className={cn(
                  'group flex flex-col gap-1.5 rounded-lg p-0.5 transition-colors sm:gap-2',
                  clickable && 'cursor-pointer hover:bg-surface-hover',
                  !clickable && 'cursor-default',
                )}
              >
                {Array.from({ length: ROWS }).map((__, r) => {
                  const i = idx(r, c);
                  const cell = state.board[i];
                  const winning = state.line?.includes(i) ?? false;
                  return (
                    <span
                      key={r}
                      className={cn(
                        'aspect-square w-full rounded-full border transition-all',
                        cell === null && 'border-border bg-background',
                        cell === 'a' && 'border-transparent bg-primary',
                        cell === 'b' && 'border-transparent bg-secondary',
                        winning && 'ring-2 ring-success ring-offset-1 ring-offset-surface',
                      )}
                    />
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      {state.winner && (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        </div>
      )}

      {/* legend */}
      <div className="flex items-center justify-center gap-5 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-3 rounded-full', myDiscDot)} />
          You
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('inline-block h-3 w-3 rounded-full', partnerDiscDot)} />
          Partner
        </span>
      </div>
    </div>
  );
}

function ScorePill({
  label,
  dot,
  value,
  highlight,
}: {
  label: string;
  dot: string;
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
      <span className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className={cn('inline-block h-2.5 w-2.5 rounded-full', dot)} />
        {label}
      </span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
