import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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
  const { colors, radius } = useTheme();
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
  let statusColor = colors.text;
  if (!state.winner) {
    if (myTurn) {
      status = 'Your turn';
      statusColor = colors.success;
    } else {
      status = "Partner's turn";
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
          <AppText style={{ fontSize: 40 }}>🔵</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const myColor = role === 'a' ? colors.primary : colors.secondary;
  const partnerColor = role === 'a' ? colors.secondary : colors.primary;

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill
          label={role === 'a' ? 'You' : 'Partner'}
          dot={colors.primary}
          value={state.scores.a}
          highlight={role === 'a'}
        />
        <ScorePill label="Draws" dot={colors.textMuted} value={state.scores.draw} />
        <ScorePill
          label={role === 'b' ? 'You' : 'Partner'}
          dot={colors.secondary}
          value={state.scores.b}
          highlight={role === 'b'}
        />
      </View>

      {/* Status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <AppText variant="label" style={{ color: statusColor }}>{status}</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppText variant="caption" muted>· you</AppText>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: myColor }} />
        </View>
      </View>

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
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: COLS }).map((_, c) => {
            const colFull = dropRow(state.board, c) < 0;
            const clickable = !state.winner && state.turn === role && !colFull;
            return (
              <Pressable
                key={c}
                onPress={() => onColClick(c)}
                disabled={!clickable}
                style={({ pressed }) => ({
                  flex: 1,
                  gap: 6,
                  borderRadius: 8,
                  padding: 2,
                  backgroundColor: pressed && clickable ? colors.surfaceHover : 'transparent',
                })}
              >
                {Array.from({ length: ROWS }).map((__, r) => {
                  const i = idx(r, c);
                  const cell = state.board[i];
                  const winning = state.line?.includes(i) ?? false;
                  const fill =
                    cell === 'a' ? colors.primary : cell === 'b' ? colors.secondary : colors.background;
                  return (
                    <View
                      key={r}
                      style={{
                        aspectRatio: 1,
                        width: '100%',
                        borderRadius: 999,
                        borderWidth: winning ? 2 : 1,
                        borderColor: winning ? colors.success : cell === null ? colors.border : 'transparent',
                        backgroundColor: fill,
                      }}
                    />
                  );
                })}
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

      {/* legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: myColor }} />
          <AppText variant="caption" muted>You</AppText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: partnerColor }} />
          <AppText variant="caption" muted>Partner</AppText>
        </View>
      </View>
    </View>
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
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
        <AppText variant="caption" muted>{label}</AppText>
      </View>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
