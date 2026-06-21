import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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

const DOT = 8; // dot diameter (px)
const LINE = 4; // drawn-line thickness (px)
const CELL = 56; // box cell size (px)

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
  const { colors, radius } = useTheme();
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
  let statusColor = colors.text;
  if (!state.winner) {
    if (myTurn) {
      status = 'Your turn';
      statusColor = colors.success;
    } else {
      status = "Partner's turn";
      statusColor = colors.textMuted;
    }
  } else if (state.winner === 'tie') {
    status = "It's a tie";
    statusColor = colors.textMuted;
  } else if (state.winner === role) {
    status = 'You win! 🎉';
    statusColor = colors.success;
  } else {
    status = 'Partner wins';
    statusColor = colors.error;
  }

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>▦</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  /** Owner-aware colour: my edges/boxes use primary, partner's use secondary. */
  const ownerColor = (o: Owner): string => {
    if (o === null) return colors.border;
    return o === role ? colors.primary : colors.secondary;
  };

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} dot={colors.primary} highlight />
        <ScorePill label="Partner" value={partnerScore} dot={colors.secondary} />
      </View>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>
        {status}
        <AppText variant="label" color={colors.textMuted}>
          {`  · ${state.scores.a + state.scores.b}/${BOX_COUNT} boxes`}
        </AppText>
      </AppText>

      {/* Board */}
      <Card variant="elevated">
        <View style={{ alignSelf: 'center' }}>
          {Array.from({ length: DOTS }).map((_, r) => (
            <View key={`row-${r}`}>
              {/* Dot row: dots interleaved with horizontal edges */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {Array.from({ length: DOTS }).map((__, c) => (
                  <View key={`dot-cluster-${r}-${c}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Dot */}
                    <View
                      style={{
                        width: DOT,
                        height: DOT,
                        borderRadius: DOT / 2,
                        backgroundColor: colors.textMuted,
                      }}
                    />
                    {/* Horizontal edge to the right of this dot (except last col) */}
                    {c < GRID && (
                      <HEdge
                        owner={state.edges[hEdge(r, c)] ?? null}
                        playable={myTurn && (state.edges[hEdge(r, c)] ?? null) === null}
                        color={ownerColor(state.edges[hEdge(r, c)] ?? null)}
                        idleColor={colors.border}
                        onPress={() => onEdgeClick(hEdge(r, c))}
                      />
                    )}
                  </View>
                ))}
              </View>

              {/* Box row: vertical edges interleaved with box cells (except after last dot row) */}
              {r < GRID && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {Array.from({ length: DOTS }).map((__, c) => (
                    <View key={`v-cluster-${r}-${c}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {/* Vertical edge below dot (col c) */}
                      <VEdge
                        owner={state.edges[vEdge(r, c)] ?? null}
                        playable={myTurn && (state.edges[vEdge(r, c)] ?? null) === null}
                        color={ownerColor(state.edges[vEdge(r, c)] ?? null)}
                        idleColor={colors.border}
                        onPress={() => onEdgeClick(vEdge(r, c))}
                      />
                      {/* Box cell to the right (except after last column) */}
                      {c < GRID && (
                        <BoxCell
                          owner={state.boxes[r * GRID + c] ?? null}
                          mine={(state.boxes[r * GRID + c] ?? null) === role}
                          radius={radius.input}
                          colors={colors}
                        />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      </Card>

      {/* Controls */}
      {state.winner && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        </View>
      )}
    </View>
  );
}

function HEdge({
  owner,
  playable,
  color,
  idleColor,
  onPress,
}: {
  owner: Owner;
  playable: boolean;
  color: string;
  idleColor: string;
  onPress: () => void;
}) {
  const drawn = owner !== null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!playable}
      hitSlop={6}
      style={{ width: CELL, height: DOT, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: CELL,
          height: LINE,
          borderRadius: LINE / 2,
          backgroundColor: drawn ? color : idleColor,
          opacity: drawn ? 1 : 0.4,
        }}
      />
    </Pressable>
  );
}

function VEdge({
  owner,
  playable,
  color,
  idleColor,
  onPress,
}: {
  owner: Owner;
  playable: boolean;
  color: string;
  idleColor: string;
  onPress: () => void;
}) {
  const drawn = owner !== null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!playable}
      hitSlop={6}
      style={{ width: DOT, height: CELL, alignItems: 'center', justifyContent: 'center' }}
    >
      <View
        style={{
          width: LINE,
          height: CELL,
          borderRadius: LINE / 2,
          backgroundColor: drawn ? color : idleColor,
          opacity: drawn ? 1 : 0.4,
        }}
      />
    </Pressable>
  );
}

function BoxCell({
  owner,
  mine,
  radius,
  colors,
}: {
  owner: Owner;
  mine: boolean;
  radius: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const closed = owner !== null;
  const bg = closed ? (mine ? colors.primaryLight : colors.secondary) : 'transparent';
  const fg = mine ? colors.primary : colors.textInverse;
  return (
    <View
      style={{
        width: CELL,
        height: CELL,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        backgroundColor: bg,
        opacity: closed && !mine ? 0.4 : 1,
      }}
    >
      {closed && (
        <AppText style={{ fontSize: 12, fontWeight: '800', color: fg }}>
          {mine ? 'You' : 'P'}
        </AppText>
      )}
    </View>
  );
}

function ScorePill({
  label,
  value,
  dot,
  highlight,
}: {
  label: string;
  value: number;
  dot: string;
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: dot }} />
        <AppText variant="caption" muted>{label}</AppText>
      </View>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
