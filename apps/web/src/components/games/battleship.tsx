'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

const SIZE = 8; // 8x8 grid
const CELLS = SIZE * SIZE;

type Player = 'a' | 'b';
type Orientation = 'h' | 'v';

interface ShipDef {
  id: string;
  name: string;
  length: number;
}

// Original fleet definitions (standard sizes, our own naming/order).
const FLEET: ReadonlyArray<ShipDef> = [
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
];

/** A placed ship on a player's own board. */
interface PlacedShip {
  id: string;
  name: string;
  length: number;
  /** Board indices (0..63) the ship occupies. */
  cells: number[];
}

interface Shot {
  index: number;
  hit: boolean;
}

/** Per-player board: their fleet + the shots fired AT them. */
interface BoardState {
  ships: PlacedShip[];
  ready: boolean;
  /** Shots the OPPONENT has fired onto this board. */
  incoming: Shot[];
}

type Phase = 'placement' | 'battle' | 'over';

/** Authoritative state, owned by the HOST (role 'a'). */
interface State {
  phase: Phase;
  turn: Player; // whose turn to fire (battle phase)
  winner: Player | null;
  /** Last resolved shot, for the "You sank their X!" banner. */
  lastShot: {
    by: Player;
    index: number;
    hit: boolean;
    sunkName: string | null;
  } | null;
  a: BoardState;
  b: BoardState;
}

function emptyBoard(): BoardState {
  return { ships: [], ready: false, incoming: [] };
}

function initialState(): State {
  return {
    phase: 'placement',
    turn: 'a',
    winner: null,
    lastShot: null,
    a: emptyBoard(),
    b: emptyBoard(),
  };
}

const rc = (index: number): { r: number; c: number } => ({
  r: Math.floor(index / SIZE),
  c: index % SIZE,
});

/** Cells a ship would occupy from a bow index, or null if out of bounds. */
function shipCells(
  bow: number,
  length: number,
  orient: Orientation,
): number[] | null {
  const { r, c } = rc(bow);
  const cells: number[] = [];
  for (let i = 0; i < length; i++) {
    const rr = orient === 'v' ? r + i : r;
    const cc = orient === 'h' ? c + i : c;
    if (rr >= SIZE || cc >= SIZE) return null;
    cells.push(rr * SIZE + cc);
  }
  return cells;
}

function occupiedSet(ships: PlacedShip[]): Set<number> {
  const s = new Set<number>();
  for (const ship of ships) for (const cell of ship.cells) s.add(cell);
  return s;
}

/** HOST-ONLY: generate a valid random placement for the whole fleet. */
function randomFleet(): PlacedShip[] {
  const placed: PlacedShip[] = [];
  const taken = new Set<number>();
  for (const def of FLEET) {
    let attempts = 0;
    while (attempts < 500) {
      attempts++;
      const orient: Orientation = Math.random() < 0.5 ? 'h' : 'v';
      const bow = Math.floor(Math.random() * CELLS);
      const cells = shipCells(bow, def.length, orient);
      if (!cells) continue;
      if (cells.some((cell) => taken.has(cell))) continue;
      for (const cell of cells) taken.add(cell);
      placed.push({ id: def.id, name: def.name, length: def.length, cells });
      break;
    }
  }
  return placed;
}

/** Count opponent ships still afloat given the shots that hit this board. */
function shipsRemaining(board: BoardState): number {
  const hits = new Set(board.incoming.filter((s) => s.hit).map((s) => s.index));
  let alive = 0;
  for (const ship of board.ships) {
    if (!ship.cells.every((cell) => hits.has(cell))) alive++;
  }
  return alive;
}

/**
 * What a given viewer is allowed to know. The host NEVER leaks the opponent's
 * ship layout — only the shots the viewer has fired (hit/miss). The viewer
 * fully sees their own board (ships + incoming shots).
 */
function publicView(s: State, viewer: Player): State {
  const opp: Player = viewer === 'a' ? 'b' : 'a';
  const oppBoard = s[opp];
  // Strip opponent ship layout; keep only their incoming shots (= my shots)
  // and reduce ships to anonymous sunk markers (length kept for count only is
  // unsafe, so we expose nothing about positions). We expose ships ONLY as the
  // set of fully-sunk cells so the tracking grid can show sunk ships.
  const sunkHits = new Set(
    oppBoard.incoming.filter((x) => x.hit).map((x) => x.index),
  );
  const exposedShips: PlacedShip[] = oppBoard.ships
    .filter((ship) => ship.cells.every((cell) => sunkHits.has(cell)))
    .map((ship) => ({ ...ship }));
  const maskedOpp: BoardState = {
    ships: exposedShips, // only fully-sunk ships revealed
    ready: oppBoard.ready,
    incoming: oppBoard.incoming, // my shots on them
  };
  return viewer === 'a'
    ? { ...s, a: s.a, b: maskedOpp }
    : { ...s, b: s.b, a: maskedOpp };
}

export function Battleship() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<Player>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Local placement UI (each client edits its OWN board before "Ready").
  const [selectedShip, setSelectedShip] = useState<string>(FLEET[0]?.id ?? '');
  const [orient, setOrient] = useState<Orientation>('h');
  const [hover, setHover] = useState<number | null>(null);

  /** HOST helper: push each side its filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

  /** HOST: store a player's finished placement and flip to battle if both ready. */
  const applyReady = useCallback(
    (player: Player, ships: PlacedShip[]) => {
      const s = stateRef.current;
      if (s.phase !== 'placement') return;
      if (ships.length !== FLEET.length) return;
      const updated: BoardState = { ...s[player], ships, ready: true };
      let next: State = { ...s, [player]: updated } as State;
      if (next.a.ready && next.b.ready) {
        next = { ...next, phase: 'battle', turn: 'a' };
      }
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: resolve a shot from `player` at `index` on the opponent board. */
  const applyFire = useCallback(
    (player: Player, index: number) => {
      const s = stateRef.current;
      if (s.phase !== 'battle') return;
      if (s.winner) return;
      if (s.turn !== player) return;
      if (!partnerHereRef.current) return;
      if (index < 0 || index >= CELLS) return;

      const opp: Player = player === 'a' ? 'b' : 'a';
      const oppBoard = s[opp];
      if (oppBoard.incoming.some((x) => x.index === index)) return; // already fired

      const hit = occupiedSet(oppBoard.ships).has(index);
      const incoming: Shot[] = [...oppBoard.incoming, { index, hit }];

      // Did this shot finish a ship?
      let sunkName: string | null = null;
      if (hit) {
        const hitSet = new Set(incoming.filter((x) => x.hit).map((x) => x.index));
        const ship = oppBoard.ships.find((sh) => sh.cells.includes(index));
        if (ship && ship.cells.every((cell) => hitSet.has(cell))) {
          sunkName = ship.name;
        }
      }

      const updatedOpp: BoardState = { ...oppBoard, incoming };
      const allSunk = updatedOpp.ships.every((sh) =>
        sh.cells.every((cell) =>
          incoming.some((x) => x.index === cell && x.hit),
        ),
      );

      const next: State = {
        ...s,
        [opp]: updatedOpp,
        // Strict alternation: one shot per turn regardless of hit/miss.
        turn: opp,
        winner: allSunk ? player : null,
        phase: allSunk ? 'over' : 'battle',
        lastShot: { by: player, index, hit, sunkName },
      } as State;

      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?:
          | { kind: 'ready'; ships: PlacedShip[] }
          | { kind: 'fire'; index: number }
          | { kind: 'random' };
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
        if (msg.action.kind === 'ready') {
          applyReady('b', msg.action.ships);
        } else if (msg.action.kind === 'fire') {
          applyFire('b', msg.action.index);
        } else if (msg.action.kind === 'random') {
          // Host generates a random fleet for the guest and marks them ready.
          applyReady('b', randomFleet());
        }
      } else if (msg.type === 'reset') {
        const next = initialState();
        setState(next);
        broadcast(next);
      }
    },
    [applyReady, applyFire, broadcast],
  );

  const { role, partnerHere, send } = useGameSession('battleship', handleMessage);
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

  // --- Local placement working copy (my own board, pre-Ready) ---
  const myBoard = state[role];
  const iAmReady = myBoard.ready;
  const [draftShips, setDraftShips] = useState<PlacedShip[]>([]);

  // Reset the local draft whenever we (re)enter placement / my ready flips off.
  useEffect(() => {
    if (state.phase === 'placement' && !iAmReady) {
      // keep existing draft; do nothing
    } else if (state.phase === 'placement' && iAmReady) {
      // synced ships come back to us — mirror them into the draft for display
      setDraftShips(myBoard.ships);
    }
  }, [state.phase, iAmReady, myBoard.ships]);

  // When a brand-new game starts (play again), clear the draft.
  const prevPhaseRef = useRef<Phase>(state.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    if (state.phase === 'placement' && prev !== 'placement') {
      setDraftShips([]);
      setSelectedShip(FLEET[0]?.id ?? '');
      setOrient('h');
    }
  }, [state.phase]);

  const placedIds = new Set(draftShips.map((s) => s.id));
  const remainingDefs = FLEET.filter((d) => !placedIds.has(d.id));
  const allPlaced = draftShips.length === FLEET.length;
  const draftOccupied = occupiedSet(draftShips);

  const selectedDef = FLEET.find((d) => d.id === selectedShip) ?? null;

  const previewCells: number[] = (() => {
    if (iAmReady || state.phase !== 'placement') return [];
    if (hover === null || !selectedDef) return [];
    if (placedIds.has(selectedDef.id)) return [];
    const cells = shipCells(hover, selectedDef.length, orient);
    if (!cells) return [];
    return cells;
  })();
  const previewValid =
    previewCells.length > 0 &&
    !previewCells.some((cell) => draftOccupied.has(cell));

  const placeBow = (bow: number) => {
    if (iAmReady || state.phase !== 'placement') return;
    if (!selectedDef || placedIds.has(selectedDef.id)) return;
    const cells = shipCells(bow, selectedDef.length, orient);
    if (!cells) return;
    if (cells.some((cell) => draftOccupied.has(cell))) return;
    const next = [
      ...draftShips,
      {
        id: selectedDef.id,
        name: selectedDef.name,
        length: selectedDef.length,
        cells,
      },
    ];
    setDraftShips(next);
    // auto-advance selection to next unplaced ship
    const nextDef = FLEET.find(
      (d) => d.id !== selectedDef.id && !next.some((s) => s.id === d.id),
    );
    if (nextDef) setSelectedShip(nextDef.id);
  };

  const removeShip = (id: string) => {
    if (iAmReady || state.phase !== 'placement') return;
    setDraftShips((ships) => ships.filter((s) => s.id !== id));
    setSelectedShip(id);
  };

  const onPlaceRandomly = () => {
    if (iAmReady || state.phase !== 'placement') return;
    if (role === 'a') {
      // Host can generate locally then commit via applyReady.
      const fleet = randomFleet();
      setDraftShips(fleet);
    } else {
      // Guest asks host to generate + mark ready (host owns randomness).
      send({ type: 'action', action: { kind: 'random' } });
    }
  };

  const onReady = () => {
    if (iAmReady || !allPlaced) return;
    if (role === 'a') {
      applyReady('a', draftShips);
    } else {
      send({ type: 'action', action: { kind: 'ready', ships: draftShips } });
    }
  };

  const onFire = (index: number) => {
    if (state.phase !== 'battle' || state.winner) return;
    if (state.turn !== role || !partnerHere) return;
    const oppBoard = state[role === 'a' ? 'b' : 'a'];
    if (oppBoard.incoming.some((x) => x.index === index)) return;
    if (role === 'a') applyFire('a', index);
    else send({ type: 'action', action: { kind: 'fire', index } });
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
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="🚢" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  // SECURITY: render only from a masked view of the authoritative state so the
  // HOST (which holds full state locally) never displays the opponent's layout.
  // The guest already receives a masked sync, and publicView is idempotent.
  const view = publicView(state, role);
  const oppBoard = view[role === 'a' ? 'b' : 'a'];
  const myShipsLeft = shipsRemaining(myBoard);
  // The masked oppBoard only ever lists FULLY-SUNK ships, so remaining =
  // total fleet minus the ships revealed as sunk. (Never derived from layout.)
  const oppShipsLeft = FLEET.length - oppBoard.ships.length;
  const myTurn = state.phase === 'battle' && state.turn === role && !state.winner;

  // ---- PLACEMENT PHASE ----
  if (state.phase === 'placement') {
    const incomingPreview = iAmReady; // once ready, just show our placed fleet
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <p className="text-center text-sm font-medium text-text">
          Placement · build your fleet
        </p>

        {!iAmReady && (
          <Card cardStyle="elevated" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-text">Your ships</span>
              <button
                onClick={() => setOrient((o) => (o === 'h' ? 'v' : 'h'))}
                className="rounded-lg border border-border bg-surface px-3 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
              >
                {orient === 'h' ? 'Horizontal' : 'Vertical'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {FLEET.map((d) => {
                const placed = placedIds.has(d.id);
                const active = selectedShip === d.id && !placed;
                return (
                  <button
                    key={d.id}
                    onClick={() =>
                      placed ? removeShip(d.id) : setSelectedShip(d.id)
                    }
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all',
                      placed
                        ? 'border-success bg-surface-hover text-success'
                        : active
                          ? 'border-primary bg-surface-hover text-primary'
                          : 'border-border bg-surface text-text-muted hover:bg-surface-hover',
                    )}
                    aria-pressed={active}
                  >
                    <span>{d.name}</span>
                    <span className="opacity-70">{d.length}</span>
                    {placed && <span aria-hidden>✓</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-text-muted">
              {allPlaced
                ? 'Fleet ready — tap a ship to reposition, or press Ready.'
                : 'Pick a ship, choose orientation, then tap a cell to drop its bow.'}
            </p>
          </Card>
        )}

        {/* Own board */}
        <Grid
          render={(i) => {
            const onShip = draftOccupied.has(i);
            const inPreview = previewCells.includes(i);
            return {
              kind: 'own',
              ship: onShip,
              previewGood: inPreview && previewValid,
              previewBad: inPreview && !previewValid,
            };
          }}
          onCellClick={incomingPreview ? undefined : placeBow}
          onCellHover={incomingPreview ? undefined : (i) => setHover(i)}
          onLeave={() => setHover(null)}
          label={iAmReady ? 'Your fleet · ready' : 'Your waters'}
        />

        <div className="flex flex-wrap items-center justify-center gap-3">
          {!iAmReady && (
            <Button variant="secondary" shape="pill" onClick={onPlaceRandomly}>
              Place randomly
            </Button>
          )}
          {!iAmReady ? (
            <Button
              variant="primary"
              shape="pill"
              onClick={onReady}
              disabled={!allPlaced}
            >
              Ready
            </Button>
          ) : (
            <p className="text-sm text-text-muted">
              Waiting for partner to ready up…
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- BATTLE / OVER PHASE ----
  let status: string;
  let tone: 'success' | 'error' | 'muted' = 'muted';
  if (state.winner) {
    if (state.winner === role) {
      status = 'Victory — you sank their whole fleet! 🎉';
      tone = 'success';
    } else {
      status = 'Defeat — your fleet was sunk';
      tone = 'error';
    }
  } else if (myTurn) {
    status = 'Your turn — fire at their waters';
    tone = 'success';
  } else {
    status = "Partner's turn — brace for impact";
    tone = 'muted';
  }

  // Sunk announcement from the most recent shot.
  let banner: { text: string; good: boolean } | null = null;
  if (state.lastShot) {
    const ls = state.lastShot;
    const mine = ls.by === role;
    if (ls.sunkName) {
      banner = mine
        ? { text: `You sank their ${ls.sunkName}! 💥`, good: true }
        : { text: `They sank your ${ls.sunkName}`, good: false };
    } else if (ls.hit) {
      banner = mine
        ? { text: 'Direct hit! 🔥', good: true }
        : { text: 'They hit one of your ships', good: false };
    } else {
      banner = mine
        ? { text: 'Splash — a miss', good: false }
        : { text: 'They missed', good: true };
    }
  }

  const myHits = new Set(myBoard.incoming.filter((s) => s.hit).map((s) => s.index));

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Ship counts */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill label="Your ships" value={myShipsLeft} total={FLEET.length} highlight />
        <ScorePill label="Their ships" value={oppShipsLeft} total={FLEET.length} />
      </div>

      <p
        className={cn(
          'text-center text-sm font-medium transition-colors',
          tone === 'success' && 'text-success',
          tone === 'error' && 'text-error',
          tone === 'muted' && 'text-text-muted',
        )}
      >
        {status}
      </p>

      {banner && (
        <p
          className={cn(
            'text-center text-sm font-semibold transition-colors',
            banner.good ? 'text-success' : 'text-error',
          )}
        >
          {banner.text}
        </p>
      )}

      {/* Tracking grid — your shots on the opponent */}
      <Grid
        render={(i) => {
          const shot = oppBoard.incoming.find((s) => s.index === i);
          // Reveal a sunk-ship cell (host only exposes fully sunk ships).
          const sunkCell = oppBoard.ships.some((sh) => sh.cells.includes(i));
          return {
            kind: 'track',
            hit: !!shot?.hit,
            miss: !!shot && !shot.hit,
            sunk: sunkCell,
            fireable: myTurn && !shot,
          };
        }}
        onCellClick={myTurn ? onFire : undefined}
        label="Their waters · take your shot"
      />

      {/* Own fleet with incoming shots */}
      <Grid
        render={(i) => {
          const onShip = occupiedSet(myBoard.ships).has(i);
          const wasHit = myHits.has(i);
          const wasMiss = myBoard.incoming.some((s) => s.index === i && !s.hit);
          return {
            kind: 'own',
            ship: onShip,
            incomingHit: wasHit,
            incomingMiss: wasMiss,
          };
        }}
        label="Your fleet · incoming fire"
      />

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

interface CellInfo {
  kind: 'own' | 'track';
  ship?: boolean;
  previewGood?: boolean;
  previewBad?: boolean;
  hit?: boolean;
  miss?: boolean;
  sunk?: boolean;
  fireable?: boolean;
  incomingHit?: boolean;
  incomingMiss?: boolean;
}

function Grid({
  render,
  onCellClick,
  onCellHover,
  onLeave,
  label,
}: {
  render: (index: number) => CellInfo;
  onCellClick?: (index: number) => void;
  onCellHover?: (index: number) => void;
  onLeave?: () => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div
        className="grid grid-cols-8 gap-1"
        onMouseLeave={onLeave}
      >
        {Array.from({ length: CELLS }, (_, i) => {
          const info = render(i);
          const hasClick = !!onCellClick;
          const clickable = hasClick && info.fireable !== false;
          return (
            <button
              key={i}
              onClick={() => onCellClick?.(i)}
              onMouseEnter={() => onCellHover?.(i)}
              disabled={!clickable}
              aria-label={`Cell ${i + 1}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-[5px] border text-xs transition-all',
                'border-border bg-surface',
                // own board
                info.ship && 'bg-secondary border-secondary',
                info.incomingMiss && 'bg-surface-hover',
                info.incomingHit && 'bg-error border-error',
                // placement preview
                info.previewGood && 'bg-success/60 border-success',
                info.previewBad && 'bg-error/50 border-error',
                // tracking board
                info.miss && 'bg-surface-hover',
                info.hit && 'bg-error border-error',
                info.sunk && 'bg-error border-error',
                clickable && 'cursor-pointer hover:bg-surface-hover',
                hasClick && !clickable && 'cursor-default',
              )}
            >
              {(info.hit || info.incomingHit) && (
                <span className="text-[10px] leading-none text-text-on-primary">
                  ✕
                </span>
              )}
              {(info.miss || info.incomingMiss) && (
                <span className="text-[8px] leading-none text-text-muted">●</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScorePill({
  label,
  value,
  total,
  highlight,
}: {
  label: string;
  value: number;
  total: number;
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
        <span className="text-sm font-normal text-text-muted"> / {total}</span>
      </span>
    </div>
  );
}
