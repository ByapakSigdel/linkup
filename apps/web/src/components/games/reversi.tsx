'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

type Disc = 'a' | 'b' | null;

interface State {
  /** 64-cell board, row-major (index = row * 8 + col). */
  board: Disc[];
  /** Whose turn it is. 'a' = Dark (host) moves first. */
  turn: 'a' | 'b';
  /** Set when the game is decided. */
  winner: 'a' | 'b' | 'draw' | null;
  /**
   * True if the side to move only got here because the OTHER side had no legal
   * move and was auto-passed. Used to surface "Partner had no move".
   */
  passed: boolean;
}

const SIZE = 8;

/** All 8 straight-line directions as [dRow, dCol]. */
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/** Deterministic placeholder so the initial render is SSR-stable. */
function initialState(): State {
  const board: Disc[] = Array(SIZE * SIZE).fill(null);
  // Standard center setup: two dark (a), two light (b).
  board[idx(3, 3)] = 'b';
  board[idx(3, 4)] = 'a';
  board[idx(4, 3)] = 'a';
  board[idx(4, 4)] = 'b';
  return { board, turn: 'a', winner: null, passed: false };
}

function idx(row: number, col: number): number {
  return row * SIZE + col;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

const opponentOf = (p: 'a' | 'b'): 'a' | 'b' => (p === 'a' ? 'b' : 'a');

/**
 * Returns the list of cell indices that would be flipped if `player` plays at
 * (row, col). Empty array means the move is illegal.
 */
function flipsFor(board: Disc[], row: number, col: number, player: 'a' | 'b'): number[] {
  if (!inBounds(row, col) || board[idx(row, col)] !== null) return [];
  const opp = opponentOf(player);
  const flips: number[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    const line: number[] = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[idx(r, c)] === opp) {
      line.push(idx(r, c));
      r += dr;
      c += dc;
    }
    // Must be bounded by our own disc, with at least one opponent disc between.
    if (line.length > 0 && inBounds(r, c) && board[idx(r, c)] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

/** All legal move indices for `player` on `board`. */
function legalMoves(board: Disc[], player: 'a' | 'b'): number[] {
  const moves: number[] = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[idx(r, c)] !== null) continue;
      if (flipsFor(board, r, c, player).length > 0) moves.push(idx(r, c));
    }
  }
  return moves;
}

function countDiscs(board: Disc[]): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const cell of board) {
    if (cell === 'a') a += 1;
    else if (cell === 'b') b += 1;
  }
  return { a, b };
}

export function Reversi() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  /**
   * HOST: apply a move at `cell` for `player`, flip discs, then resolve turn
   * order including auto-pass and end-of-game detection. Re-broadcasts sync.
   */
  const applyAction = useCallback((cell: number, player: 'a' | 'b') => {
    const s = stateRef.current;
    if (s.winner) return;
    if (s.turn !== player) return;
    if (cell < 0 || cell >= SIZE * SIZE) return;

    const row = Math.floor(cell / SIZE);
    const col = cell % SIZE;
    const flips = flipsFor(s.board, row, col, player);
    if (flips.length === 0) return; // illegal

    const board = s.board.slice();
    board[cell] = player;
    for (const f of flips) board[f] = player;

    const opp = opponentOf(player);
    let next: State;

    if (legalMoves(board, opp).length > 0) {
      // Opponent can move normally.
      next = { board, turn: opp, winner: null, passed: false };
    } else if (legalMoves(board, player).length > 0) {
      // Opponent must pass; same player moves again.
      next = { board, turn: player, winner: null, passed: true };
    } else {
      // Neither side can move — game over.
      const counts = countDiscs(board);
      const winner: State['winner'] =
        counts.a > counts.b ? 'a' : counts.b > counts.a ? 'b' : 'draw';
      next = { board, turn: opp, winner, passed: false };
    }

    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { cell?: number };
      };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        sendRef.current({ type: 'sync', state: stateRef.current });
      } else if (msg.type === 'action' && msg.action) {
        if (typeof msg.action.cell === 'number') applyAction(msg.action.cell, 'b');
      } else if (msg.type === 'reset') {
        const next = initialState();
        setState(next);
        sendRef.current({ type: 'sync', state: next });
      }
    },
    [applyAction],
  );

  const { role, partnerHere, send } = useGameSession('reversi', handleMessage);
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

  const myTurn = state.turn === role && !state.winner && partnerHere;
  const myLegal = myTurn ? legalMoves(state.board, role) : [];
  const counts = countDiscs(state.board);
  const myCount = counts[role];
  const partnerCount = counts[opponentOf(role)];

  const onCellClick = (cell: number) => {
    if (!myTurn) return;
    if (!myLegal.includes(cell)) return;
    if (role === 'a') applyAction(cell, 'a');
    else send({ type: 'action', action: { cell } });
  };

  const onPlayAgain = () => {
    if (role === 'a') {
      const next = initialState();
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
      status = state.passed ? 'Partner had no move — your turn again' : 'Your turn';
      statusTone = 'success';
    } else {
      status = state.passed
        ? 'You had no move — partner plays again'
        : "Partner's turn";
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
          <span className="text-4xl">⚫</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill
          label="You"
          discTone={role === 'a' ? 'dark' : 'light'}
          value={myCount}
          highlight
        />
        <ScorePill
          label="Partner"
          discTone={role === 'a' ? 'light' : 'dark'}
          value={partnerCount}
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
        <span className="ml-1.5 text-text-muted">
          · You are {role === 'a' ? 'Dark' : 'Light'}
        </span>
      </p>

      {/* Board */}
      <div className="rounded-2xl border border-border bg-surface p-2">
        <div className="grid grid-cols-8 gap-1">
          {state.board.map((cell, i) => {
            const isHint = myLegal.includes(i);
            return (
              <button
                key={i}
                onClick={() => onCellClick(i)}
                disabled={!isHint}
                aria-label={`Cell ${i + 1}`}
                className={cn(
                  'relative flex aspect-square items-center justify-center rounded-md border border-border transition-colors',
                  'bg-surface-hover',
                  isHint && 'cursor-pointer hover:bg-surface',
                  !isHint && 'cursor-default',
                )}
              >
                {cell && (
                  <span
                    className={cn(
                      'block aspect-square w-[78%] rounded-full shadow-sm transition-all duration-200',
                      cell === 'a'
                        ? 'bg-primary'
                        : 'border border-border bg-text',
                    )}
                  />
                )}
                {!cell && isHint && (
                  <span
                    className={cn(
                      'block aspect-square w-[26%] rounded-full opacity-50',
                      role === 'a' ? 'bg-primary' : 'bg-text',
                    )}
                  />
                )}
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
    </div>
  );
}

function ScorePill({
  label,
  discTone,
  value,
  highlight,
}: {
  label: string;
  discTone: 'dark' | 'light';
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 text-center transition-colors',
        highlight ? 'border-primary bg-surface-hover' : 'border-border bg-surface',
      )}
    >
      <span
        className={cn(
          'block h-4 w-4 shrink-0 rounded-full',
          discTone === 'dark' ? 'bg-primary' : 'border border-border bg-text',
        )}
      />
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
