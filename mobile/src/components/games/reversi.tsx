import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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

function idx(row: number, col: number): number {
  return row * SIZE + col;
}

function initialState(): State {
  const board: Disc[] = Array(SIZE * SIZE).fill(null);
  // Standard center setup: two dark (a), two light (b).
  board[idx(3, 3)] = 'b';
  board[idx(3, 4)] = 'a';
  board[idx(4, 3)] = 'a';
  board[idx(4, 4)] = 'b';
  return { board, turn: 'a', winner: null, passed: false };
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
  const { colors, radius } = useTheme();
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
  let statusColor = colors.text;
  if (!state.winner) {
    if (myTurn) {
      status = state.passed ? 'Partner had no move — your turn again' : 'Your turn';
      statusColor = colors.success;
    } else {
      status = state.passed
        ? 'You had no move — partner plays again'
        : "Partner's turn";
      statusColor = colors.textMuted;
    }
  } else if (state.winner === 'draw') {
    status = "It's a draw";
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
          <AppText style={{ fontSize: 40 }}>⚫</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  // Disc colours: 'a' = Dark (primary), 'b' = Light (text on bordered chip).
  const discFill = (disc: 'a' | 'b'): string => (disc === 'a' ? colors.primary : colors.text);
  const discBorder = (disc: 'a' | 'b'): string => (disc === 'a' ? colors.primary : colors.border);

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
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
      </View>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>
        {status}
        <AppText variant="label" color={colors.textMuted}>
          {`  · You are ${role === 'a' ? 'Dark' : 'Light'}`}
        </AppText>
      </AppText>

      {/* Board */}
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 8,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {state.board.map((cell, i) => {
            const isHint = myLegal.includes(i);
            return (
              <Pressable
                key={i}
                onPress={() => onCellClick(i)}
                disabled={!isHint}
                style={({ pressed }) => ({
                  width: `${100 / SIZE}%`,
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor:
                    pressed && isHint ? colors.surface : colors.surfaceHover,
                  // compensate for the 4px gap so 8 cells fit a row.
                  marginRight: -0.5,
                })}
              >
                {cell ? (
                  <View
                    style={{
                      width: '78%',
                      aspectRatio: 1,
                      borderRadius: 999,
                      borderWidth: cell === 'b' ? 1 : 0,
                      borderColor: discBorder(cell),
                      backgroundColor: discFill(cell),
                    }}
                  />
                ) : isHint ? (
                  <View
                    style={{
                      width: '26%',
                      aspectRatio: 1,
                      borderRadius: 999,
                      opacity: 0.5,
                      backgroundColor: role === 'a' ? colors.primary : colors.text,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Controls */}
      {state.winner && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        </View>
      )}
    </View>
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
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: radius.card,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 10,
        borderColor: highlight ? colors.primary : colors.border,
        backgroundColor: highlight ? colors.surfaceHover : colors.surface,
      }}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          borderWidth: discTone === 'light' ? 1 : 0,
          borderColor: colors.border,
          backgroundColor: discTone === 'dark' ? colors.primary : colors.text,
        }}
      />
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
