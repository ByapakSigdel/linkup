import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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
  const { colors, radius } = useTheme();
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
          <AppText style={{ fontSize: 40 }}>⭕</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
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
      </View>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>
        {status}
        <AppText variant="label" color={colors.textMuted}>{`  · You are ${MARK[role]}`}</AppText>
      </AppText>

      {/* Board */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {state.board.map((cell, i) => {
          const winning = state.line?.includes(i) ?? false;
          const playable = !cell && !state.winner && state.turn === role;
          const markColor = winning
            ? colors.success
            : cell === 'a'
              ? colors.primary
              : colors.accent;
          return (
            <Pressable
              key={i}
              onPress={() => onCellClick(i)}
              disabled={!playable}
              style={({ pressed }) => ({
                width: '31%',
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: winning ? colors.success : colors.border,
                backgroundColor: winning
                  ? colors.surfaceHover
                  : pressed && playable
                    ? colors.surfaceHover
                    : colors.surface,
              })}
            >
              <AppText style={{ fontSize: 40, fontWeight: '800', color: markColor }}>
                {cell ? MARK[cell] : ''}
              </AppText>
            </Pressable>
          );
        })}
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
  mark,
  value,
  highlight,
}: {
  label: string;
  mark: string;
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
      <AppText variant="caption" muted>{`${mark} ${label}`}</AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
