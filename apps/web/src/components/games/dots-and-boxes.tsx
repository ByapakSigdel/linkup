'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Dots and Boxes on a 5x5 dot lattice (4x4 = 16 boxes).
 *
 * Edge model:
 *  - Horizontal edges: (GRID + 1) rows of GRID edges each = 5 * 4 = 20
 *  - Vertical edges:   GRID rows of (GRID + 1) edges each   = 4 * 5 = 20
 *  - Edges are indexed: horizontals first [0..19], then verticals [20..39].
 */

const GRID = 4; // boxes per side (4x4)
const DOTS = GRID + 1; // dots per side (5x5)

const H_COUNT = DOTS * GRID; // 20 horizontal edges
const V_COUNT = GRID * DOTS; // 20 vertical edges
const EDGE_COUNT = H_COUNT + V_COUNT; // 40
const BOX_COUNT = GRID * GRID; // 16

type Owner = 'a' | 'b' | null;

interface State {
  /** Owner who drew each edge (null = undrawn). length === EDGE_COUNT */
  edges: Owner[];
  /** Owner of each completed box (null = not yet closed). length === BOX_COUNT */
  boxes: Owner[];
  turn: 'a' | 'b';
  scores: { a: number; b: number };
  /** null while playing, then the match winner / 'tie'. */
  winner: 'a' | 'b' | 'tie' | null;
}

function initialState(): State {
  return {
    edges: Array<Owner>(EDGE_COUNT).fill(null),
    boxes: Array<Owner>(BOX_COUNT).fill(null),
    turn: 'a',
    scores: { a: 0, b: 0 },
    winner: null,
  };
}

/* ---- edge index helpers ---- */

/** Horizontal edge index for the top side of cell (r,c). r in [0..DOTS-1], c in [0..GRID-1]. */
function hEdge(r: number, c: number): number {
  return r * GRID + c;
}
/** Vertical edge index for the left side of cell (r,c). r in [0..GRID-1], c in [0..DOTS-1]. */
function vEdge(r: number, c: number): number {
  return H_COUNT + r * DOTS + c;
}

/** The four edge indices that bound box (br, bc), br/bc in [0..GRID-1]. */
function boxEdges(br: number, bc: number): [number, number, number, number] {
  return [
    hEdge(br, bc), // top
    hEdge(br + 1, bc), // bottom
    vEdge(br, bc), // left
    vEdge(br, bc + 1), // right
  ];
}

/** Boxes adjacent to a given edge (1 or 2 box indices). */
function boxesForEdge(edge: number): number[] {
  const out: number[] = [];
  if (edge < H_COUNT) {
    const r = Math.floor(edge / GRID);
    const c = edge % GRID;
    if (r - 1 >= 0) out.push((r - 1) * GRID + c); // box above
    if (r < GRID) out.push(r * GRID + c); // box below
  } else {
    const v = edge - H_COUNT;
    const r = Math.floor(v / DOTS);
    const c = v % DOTS;
    if (c - 1 >= 0) out.push(r * GRID + (c - 1)); // box to the left
    if (c < GRID) out.push(r * GRID + c); // box to the right
  }
  return out;
}

export function DotsAndBoxes() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  /** HOST: validate + apply an edge claim, handle box completion + extra turn. */
  const applyAction = useCallback((edge: number, player: 'a' | 'b') => {
    const s = stateRef.current;
    if (s.winner) return;
    if (s.turn !== player) return;
    if (edge < 0 || edge >= EDGE_COUNT) return;
    if (s.edges[edge] !== null) return;

    const edges = s.edges.slice();
    edges[edge] = player;

    // Recompute boxes that touch this edge; count how many this move closes.
    const boxes = s.boxes.slice();
    let claimed = 0;
    for (const b of boxesForEdge(edge)) {
      if (boxes[b] !== null) continue;
      const br = Math.floor(b / GRID);
      const bc = b % GRID;
      const allDrawn = boxEdges(br, bc).every((e) => edges[e] !== null);
      if (allDrawn) {
        boxes[b] = player;
        claimed += 1;
      }
    }

    const scores = { ...s.scores };
    if (claimed > 0) scores[player] += claimed;

    // Game ends when every box is owned.
    const filled = boxes.every((b) => b !== null);
    let winner: State['winner'] = null;
    if (filled) {
      winner = scores.a > scores.b ? 'a' : scores.b > scores.a ? 'b' : 'tie';
    }

    // Completing at least one box grants another turn.
    const nextTurn: 'a' | 'b' = claimed > 0 ? player : player === 'a' ? 'b' : 'a';

    const next: State = {
      edges,
      boxes,
      turn: winner ? s.turn : nextTurn,
      scores,
      winner,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { edge: number };
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
        applyAction(msg.action.edge, 'b');
      } else if (msg.type === 'reset') {
        const next = initialState();
        setState(next);
        sendRef.current({ type: 'sync', state: next });
      }
    },
    [applyAction],
  );

  const { role, partnerHere, send } = useGameSession('dots-and-boxes', handleMessage);
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

  const onEdgeClick = (edge: number) => {
    if (!partnerHere || state.winner) return;
    if (state.turn !== role) return;
    if (state.edges[edge] !== null) return;
    if (role === 'a') {
      applyAction(edge, 'a');
    } else {
      send({ type: 'action', action: { edge } });
    }
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

  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];

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
  } else if (state.winner === 'tie') {
    status = "It's a tie";
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
          <span className="text-4xl">▦</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  /** Owner-aware classes: my edges/boxes use primary, partner's use secondary. */
  const ownerEdgeClass = (o: Owner): string => {
    if (o === null) return 'bg-border/40';
    return o === role ? 'bg-primary' : 'bg-secondary';
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill label="You" value={myScore} tone="primary" highlight />
        <ScorePill label="Partner" value={partnerScore} tone="secondary" />
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
          · {state.scores.a + state.scores.b}/{BOX_COUNT} boxes
        </span>
      </p>

      {/* Board */}
      <Card cardStyle="elevated" className="overflow-hidden">
        <Board
          state={state}
          role={role}
          myTurn={myTurn}
          onEdgeClick={onEdgeClick}
          ownerEdgeClass={ownerEdgeClass}
        />
      </Card>

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

function Board({
  state,
  role,
  myTurn,
  onEdgeClick,
  ownerEdgeClass,
}: {
  state: State;
  role: 'a' | 'b';
  myTurn: boolean;
  onEdgeClick: (edge: number) => void;
  ownerEdgeClass: (o: Owner) => string;
}) {
  // Build a CSS grid that interleaves dots, edges, and box cells.
  // Column / row tracks: dot, gap, dot, gap, ... -> (2*DOTS - 1) tracks.
  const tracks = 2 * DOTS - 1;
  const els: React.ReactNode[] = [];

  for (let gr = 0; gr < tracks; gr++) {
    for (let gc = 0; gc < tracks; gc++) {
      const onDotRow = gr % 2 === 0;
      const onDotCol = gc % 2 === 0;

      if (onDotRow && onDotCol) {
        // Dot
        els.push(
          <span
            key={`d-${gr}-${gc}`}
            className="h-2 w-2 justify-self-center rounded-full bg-text-muted"
            aria-hidden
          />,
        );
        continue;
      }

      if (onDotRow && !onDotCol) {
        // Horizontal edge between two dots in dot-row (gr/2).
        const r = gr / 2;
        const c = (gc - 1) / 2;
        const edge = hEdge(r, c);
        els.push(renderEdge(edge, 'h'));
        continue;
      }

      if (!onDotRow && onDotCol) {
        // Vertical edge in box-row (gr-1)/2, dot-col gc/2.
        const r = (gr - 1) / 2;
        const c = gc / 2;
        const edge = vEdge(r, c);
        els.push(renderEdge(edge, 'v'));
        continue;
      }

      // Box cell at box-row (gr-1)/2, box-col (gc-1)/2.
      const br = (gr - 1) / 2;
      const bc = (gc - 1) / 2;
      const b = br * GRID + bc;
      const owner = state.boxes[b] ?? null;
      els.push(
        <span
          key={`b-${b}`}
          className={cn(
            'flex items-center justify-center rounded-sm text-xs font-bold transition-colors duration-200',
            owner === null && 'text-transparent',
            owner !== null && owner === role && 'bg-primary-light text-primary',
            owner !== null && owner !== role && 'bg-secondary/15 text-secondary',
          )}
          aria-hidden={owner === null}
        >
          {owner === null ? '' : owner === role ? 'You' : 'P'}
        </span>,
      );
    }
  }

  function renderEdge(edge: number, dir: 'h' | 'v') {
    const owner = state.edges[edge] ?? null;
    const drawn = owner !== null;
    const playable = !drawn && myTurn;
    return (
      <button
        key={`e-${edge}`}
        type="button"
        onClick={() => onEdgeClick(edge)}
        disabled={!playable}
        aria-label={drawn ? 'Drawn line' : 'Draw line'}
        className={cn(
          'group relative flex items-center justify-center',
          dir === 'h' ? 'h-3 w-full' : 'h-full w-3 justify-self-center',
          playable ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <span
          className={cn(
            'rounded-full transition-all duration-150',
            dir === 'h' ? 'h-1 w-full' : 'h-full w-1',
            drawn
              ? ownerEdgeClass(owner)
              : playable
                ? 'bg-border/40 group-hover:bg-primary/60'
                : 'bg-border/40',
          )}
        />
      </button>
    );
  }

  // Track sizing: dot tracks are fixed-small, edge/box tracks flex.
  const template = Array.from({ length: tracks }, (_, i) =>
    i % 2 === 0 ? 'auto' : '1fr',
  ).join(' ');

  return (
    <div
      className="grid w-full place-items-stretch gap-y-0.5"
      style={{
        gridTemplateColumns: template,
        gridTemplateRows: template,
      }}
    >
      {els}
    </div>
  );
}

function ScorePill({
  label,
  value,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'secondary';
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
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-sm',
            tone === 'primary' ? 'bg-primary' : 'bg-secondary',
          )}
        />
        {label}
      </span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
