import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

const SIZE = 8; // 8x8 grid
const CELLS = SIZE * SIZE;
const GAP = 4;

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
 * fully sees their own board (ships + incoming shots). Opponent ships are
 * exposed ONLY as the set of fully-sunk ships (never positions of live ships).
 */
function publicView(s: State, viewer: Player): State {
  const opp: Player = viewer === 'a' ? 'b' : 'a';
  const oppBoard = s[opp];
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
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<Player>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Local placement UI (each client edits its OWN board before "Ready").
  const [selectedShip, setSelectedShip] = useState<string>(FLEET[0]?.id ?? '');
  const [orient, setOrient] = useState<Orientation>('h');

  /** HOST helper: push the guest its filtered view. */
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
        sh.cells.every((cell) => incoming.some((x) => x.index === cell && x.hit)),
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

  // Mirror synced ships into the draft for display once ready.
  useEffect(() => {
    if (state.phase === 'placement' && iAmReady) {
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
  const allPlaced = draftShips.length === FLEET.length;
  const draftOccupied = occupiedSet(draftShips);

  const selectedDef = FLEET.find((d) => d.id === selectedShip) ?? null;

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
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>🚢</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  // SECURITY: render only from a masked view of the authoritative state so the
  // HOST (which holds full state locally) never displays the opponent's layout.
  const view = publicView(state, role);
  const oppBoard = view[role === 'a' ? 'b' : 'a'];
  const myShipsLeft = shipsRemaining(myBoard);
  // The masked oppBoard only ever lists FULLY-SUNK ships, so remaining =
  // total fleet minus the ships revealed as sunk. (Never derived from layout.)
  const oppShipsLeft = FLEET.length - oppBoard.ships.length;
  const myTurn = state.phase === 'battle' && state.turn === role && !state.winner;

  // ---- PLACEMENT PHASE ----
  if (state.phase === 'placement') {
    return (
      <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
        <AppText center variant="label">Placement · build your fleet</AppText>

        {!iAmReady && (
          <Card variant="elevated">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText variant="label">Your ships</AppText>
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => setOrient((o) => (o === 'h' ? 'v' : 'h'))}
                  label={orient === 'h' ? 'Horizontal' : 'Vertical'}
                />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {FLEET.map((d) => {
                  const placed = placedIds.has(d.id);
                  const active = selectedShip === d.id && !placed;
                  const borderColor = placed
                    ? colors.success
                    : active
                      ? colors.primary
                      : colors.border;
                  const textColor = placed
                    ? colors.success
                    : active
                      ? colors.primary
                      : colors.textMuted;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => (placed ? removeShip(d.id) : setSelectedShip(d.id))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        borderRadius: radius.button,
                        borderWidth: 1,
                        borderColor,
                        backgroundColor:
                          placed || active ? colors.surfaceHover : colors.surface,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <AppText variant="caption" style={{ color: textColor, fontWeight: '600' }}>
                        {d.name}
                      </AppText>
                      <AppText variant="caption" style={{ color: textColor, opacity: 0.7 }}>
                        {d.length}
                      </AppText>
                      {placed && (
                        <AppText variant="caption" style={{ color: colors.success }}>✓</AppText>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <AppText variant="caption" muted>
                {allPlaced
                  ? 'Fleet ready — tap a placed ship to reposition, or press Ready.'
                  : 'Pick a ship, choose orientation, then tap a cell to drop its bow.'}
              </AppText>
            </View>
          </Card>
        )}

        {/* Own board */}
        <Grid
          colors={colors}
          render={(i) => ({
            ship: draftOccupied.has(i),
          })}
          onCellPress={iAmReady ? undefined : placeBow}
          label={iAmReady ? 'Your fleet · ready' : 'Your waters'}
        />

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {!iAmReady && (
            <Button variant="secondary" onPress={onPlaceRandomly} label="Place randomly" />
          )}
          {!iAmReady ? (
            <Button variant="primary" onPress={onReady} disabled={!allPlaced} label="Ready" />
          ) : (
            <AppText variant="body" muted>Waiting for partner to ready up…</AppText>
          )}
        </View>
      </View>
    );
  }

  // ---- BATTLE / OVER PHASE ----
  let status: string;
  let statusColor = colors.textMuted;
  if (state.winner) {
    if (state.winner === role) {
      status = 'Victory — you sank their whole fleet! 🎉';
      statusColor = colors.success;
    } else {
      status = 'Defeat — your fleet was sunk';
      statusColor = colors.error;
    }
  } else if (myTurn) {
    status = 'Your turn — fire at their waters';
    statusColor = colors.success;
  } else {
    status = "Partner's turn — brace for impact";
    statusColor = colors.textMuted;
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
  const myOcc = occupiedSet(myBoard.ships);

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Ship counts */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="Your ships" value={myShipsLeft} total={FLEET.length} highlight />
        <ScorePill label="Their ships" value={oppShipsLeft} total={FLEET.length} />
      </View>

      <AppText center variant="label" style={{ color: statusColor }}>{status}</AppText>

      {banner && (
        <AppText
          center
          variant="label"
          style={{ color: banner.good ? colors.success : colors.error, fontWeight: '700' }}
        >
          {banner.text}
        </AppText>
      )}

      {/* Tracking grid — your shots on the opponent */}
      <Grid
        colors={colors}
        render={(i) => {
          const shot = oppBoard.incoming.find((s) => s.index === i);
          // Reveal a sunk-ship cell (host only exposes fully sunk ships).
          const sunkCell = oppBoard.ships.some((sh) => sh.cells.includes(i));
          return {
            hit: !!shot?.hit,
            miss: !!shot && !shot.hit,
            sunk: sunkCell,
            fireable: myTurn && !shot,
          };
        }}
        onCellPress={myTurn ? onFire : undefined}
        label="Their waters · take your shot"
      />

      {/* Own fleet with incoming shots */}
      <Grid
        colors={colors}
        render={(i) => ({
          ship: myOcc.has(i),
          incomingHit: myHits.has(i),
          incomingMiss: myBoard.incoming.some((s) => s.index === i && !s.hit),
        })}
        label="Your fleet · incoming fire"
      />

      {state.winner && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        </View>
      )}
    </View>
  );
}

interface CellInfo {
  ship?: boolean;
  hit?: boolean;
  miss?: boolean;
  sunk?: boolean;
  fireable?: boolean;
  incomingHit?: boolean;
  incomingMiss?: boolean;
}

function Grid({
  colors,
  render,
  onCellPress,
  label,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  render: (index: number) => CellInfo;
  onCellPress?: (index: number) => void;
  label: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" muted>{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {Array.from({ length: CELLS }, (_, i) => {
          const info = render(i);
          const fireable = info.fireable !== false;
          const clickable = !!onCellPress && fireable;

          let bg = colors.surface;
          let border = colors.border;
          if (info.ship) {
            bg = colors.secondary;
            border = colors.secondary;
          }
          if (info.incomingMiss || info.miss) {
            bg = colors.surfaceHover;
          }
          if (info.incomingHit || info.hit || info.sunk) {
            bg = colors.error;
            border = colors.error;
          }

          const showHit = info.hit || info.incomingHit;
          const showMiss = info.miss || info.incomingMiss;

          return (
            <Pressable
              key={i}
              onPress={() => onCellPress?.(i)}
              disabled={!clickable}
              style={({ pressed }) => ({
                width: `${100 / SIZE}%`,
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 5,
                borderWidth: 1,
                borderColor: border,
                backgroundColor: pressed && clickable ? colors.surfaceHover : bg,
                marginRight: -0.5,
              })}
            >
              {showHit && (
                <AppText style={{ fontSize: 10, lineHeight: 12, color: colors.textOnPrimary }}>
                  ✕
                </AppText>
              )}
              {showMiss && (
                <AppText style={{ fontSize: 8, lineHeight: 10, color: colors.textMuted }}>
                  ●
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
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
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <AppText variant="title">{value}</AppText>
        <AppText variant="caption" muted>{` / ${total}`}</AppText>
      </View>
    </View>
  );
}
