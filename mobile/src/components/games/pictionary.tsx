import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card, Input } from '@/components/ui';
import {
  ScribbleCanvas,
  type ScribbleCanvasHandle,
  type RemoteScribbleStroke,
} from '@/components/creative';

/**
 * Pictionary — the drawer sees a secret word and draws it; the guesser watches
 * the strokes appear live on a locked canvas and types guesses. Strokes are
 * relayed through the game session (not the scribble socket): the drawer emits
 * `{ type: 'stroke', stroke }` / `{ type: 'clearcanvas' }`, and the non-drawer
 * reproduces them via the canvas ref. HOST (role 'a') owns authoritative state.
 */

/**
 * Original word list — simple, drawable everyday things, animals, food, and
 * couple/date themes. Written by hand for this game.
 */
const WORDS: readonly string[] = [
  // Everyday objects
  'umbrella',
  'ladder',
  'key',
  'clock',
  'glasses',
  'candle',
  'balloon',
  'guitar',
  'camera',
  'lamp',
  'book',
  'kite',
  // Animals
  'cat',
  'dog',
  'butterfly',
  'penguin',
  'turtle',
  'octopus',
  'snail',
  'owl',
  'fish',
  'bee',
  // Food
  'pizza',
  'ice cream',
  'cupcake',
  'banana',
  'donut',
  'strawberry',
  'popcorn',
  'pancakes',
  // Couple / date themes
  'heart',
  'kiss',
  'love letter',
  'wedding ring',
  'rose',
  'sunset',
  'picnic',
  'movie night',
  'slow dance',
  'holding hands',
  'first date',
  'star gazing',
];

type Phase = 'drawing' | 'revealed';

interface Guess {
  id: number;
  by: 'a' | 'b';
  text: string;
  correct: boolean;
}

interface State {
  /** Whose turn it is to draw. */
  drawer: 'a' | 'b';
  /** The secret word for the current round. */
  word: string;
  round: number;
  phase: Phase;
  /** True when the current word was revealed by a correct guess (vs skipped). */
  solved: boolean;
  scores: { a: number; b: number };
  guesses: Guess[];
}

function pickWord(exclude?: string): string {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)]!;
  if (exclude && WORDS.length > 1) {
    let guard = 0;
    while (w === exclude && guard++ < 8) {
      w = WORDS[Math.floor(Math.random() * WORDS.length)]!;
    }
  }
  return w;
}

/** Host-only: build the very first round state (role 'a' draws round 1). */
function freshGame(): State {
  return {
    drawer: 'a',
    word: pickWord(),
    round: 1,
    phase: 'drawing',
    solved: false,
    scores: { a: 0, b: 0 },
    guesses: [],
  };
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function Pictionary() {
  const { colors, radius } = useTheme();

  // Host seeds real state lazily in an effect. Guests start empty and fill in
  // from the host's first sync.
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});
  const seededRef = useRef(false);

  const canvasRef = useRef<ScribbleCanvasHandle>(null);

  const [guessText, setGuessText] = useState('');
  const guessIdRef = useRef(0);

  // ─── Host: round transitions ────────────────────────────────────────────────

  const startNextRound = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    const nextDrawer: 'a' | 'b' = s.drawer === 'a' ? 'b' : 'a';
    const next: State = {
      drawer: nextDrawer,
      word: pickWord(s.word),
      round: s.round + 1,
      phase: 'drawing',
      solved: false,
      scores: s.scores,
      guesses: [],
    };
    // Wipe both canvases for the new round.
    canvasRef.current?.clearLocal();
    sendRef.current({ type: 'clearcanvas' });
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  /** Host applies a guess from a given player. */
  const applyGuess = useCallback((player: 'a' | 'b', text: string) => {
    const s = stateRef.current;
    if (!s) return;
    if (s.phase !== 'drawing') return;
    if (player === s.drawer) return;
    const cleaned = text.trim();
    if (!cleaned) return;

    const correct = norm(cleaned) === norm(s.word);
    const guess: Guess = {
      id: ++guessIdRef.current,
      by: player,
      text: cleaned,
      correct,
    };
    const guesses = [...s.guesses, guess].slice(-12);

    if (correct) {
      const next: State = {
        ...s,
        phase: 'revealed',
        solved: true,
        scores: { ...s.scores, [player]: s.scores[player] + 1 },
        guesses,
      };
      setState(next);
      sendRef.current({ type: 'sync', state: next });
    } else {
      const next: State = { ...s, guesses };
      setState(next);
      sendRef.current({ type: 'sync', state: next });
    }
  }, []);

  /** Host reveals the word without awarding a point (drawer skipped). */
  const revealAndSkip = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase !== 'drawing') return;
    const next: State = { ...s, phase: 'revealed', solved: false };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  // ─── Message handling ────────────────────────────────────────────────────────

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind: 'guess'; text: string } | { kind: 'skip' } | { kind: 'next' };
        stroke?: RemoteScribbleStroke;
      };
      const role = roleRef.current;

      // Stroke relay applies to BOTH sides: whoever is NOT the drawer reproduces
      // the incoming strokes on their (locked) canvas.
      if (msg.type === 'stroke' && msg.stroke) {
        const s = stateRef.current;
        if (s && s.drawer !== role) {
          canvasRef.current?.applyRemoteStroke(msg.stroke);
        }
        return;
      }
      if (msg.type === 'clearcanvas') {
        const s = stateRef.current;
        if (s && s.drawer !== role) {
          canvasRef.current?.clearLocal();
        }
        return;
      }

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

      // HOST (role 'a') owns the game.
      if (msg.type === 'hello') {
        if (stateRef.current) {
          sendRef.current({ type: 'sync', state: stateRef.current });
        }
      } else if (msg.type === 'action' && msg.action) {
        if (msg.action.kind === 'guess') {
          applyGuess('b', msg.action.text);
        } else if (msg.action.kind === 'skip') {
          if (stateRef.current?.drawer === 'b') revealAndSkip();
        } else if (msg.action.kind === 'next') {
          startNextRound();
        }
      }
    },
    [applyGuess, revealAndSkip, startNextRound],
  );

  const { role, partnerHere, send } = useGameSession('pictionary', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Host seeds the first game state once (in an effect, not render).
  useEffect(() => {
    if (role === 'a' && !seededRef.current && !stateRef.current) {
      seededRef.current = true;
      const initial = freshGame();
      setState(initial);
      send({ type: 'sync', state: initial });
    }
  }, [role, send]);

  // Guest announces itself so the host sends the current state.
  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  // Host re-broadcasts whenever the partner (re)joins.
  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere && stateRef.current) {
      send({ type: 'sync', state: stateRef.current });
    }
  }, [partnerHere, role, send]);

  // ─── Local intents ───────────────────────────────────────────────────────────

  const submitGuess = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase !== 'drawing') return;
    if (s.drawer === role) return;
    const text = guessText.trim();
    if (!text) return;
    setGuessText('');
    if (role === 'a') {
      applyGuess('a', text);
    } else {
      send({ type: 'action', action: { kind: 'guess', text } });
    }
  }, [role, guessText, applyGuess, send]);

  const onSkip = useCallback(() => {
    const s = stateRef.current;
    if (!s || s.phase !== 'drawing' || s.drawer !== role) return;
    if (role === 'a') {
      revealAndSkip();
    } else {
      send({ type: 'action', action: { kind: 'skip' } });
    }
  }, [role, revealAndSkip, send]);

  const onNextRound = useCallback(() => {
    if (role === 'a') {
      startNextRound();
    } else {
      send({ type: 'action', action: { kind: 'next' } });
    }
  }, [role, startNextRound, send]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
          <AppText style={{ fontSize: 40 }}>🎨</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
          <AppText style={{ fontSize: 40 }}>🎨</AppText>
          <AppText muted>Setting up the round…</AppText>
        </View>
      </Card>
    );
  }

  const iAmDrawer = state.drawer === role;
  const myScore = role === 'a' ? state.scores.a : state.scores.b;
  const partnerScore = role === 'a' ? state.scores.b : state.scores.a;

  let statusText: string;
  let statusColor = colors.text;
  if (state.phase === 'revealed') {
    if (state.solved) {
      statusText = 'Guessed it! 🎉';
      statusColor = colors.success;
    } else {
      statusText = 'Word revealed';
      statusColor = colors.textMuted;
    }
  } else if (iAmDrawer) {
    statusText = "You're drawing — make them guess!";
    statusColor = colors.success;
  } else {
    statusText = "Guess what they're drawing!";
  }

  const blanks = state.word
    .split('')
    .map((ch) => (ch === ' ' ? '  ' : '_'))
    .join(' ');

  return (
    <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 14 }}>
      {/* Header: round + scores */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} highlight />
        <ScorePill label="Round" value={state.round} />
        <ScorePill label="Partner" value={partnerScore} />
      </View>

      {/* Status */}
      <Animated.View key={statusText} entering={FadeIn.duration(300)}>
        <AppText center variant="label" style={{ color: statusColor }}>
          {statusText}
        </AppText>
      </Animated.View>

      {/* Word area */}
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 12,
          alignItems: 'center',
          gap: 2,
        }}
      >
        {iAmDrawer ? (
          <>
            <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Draw this
            </AppText>
            <AppText
              variant="subtitle"
              weight="800"
              style={{ color: colors.primary, textTransform: 'capitalize' }}
            >
              {state.word}
            </AppText>
          </>
        ) : state.phase === 'revealed' ? (
          <>
            <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              The word was
            </AppText>
            <AppText
              variant="subtitle"
              weight="800"
              style={{
                textTransform: 'capitalize',
                color: state.solved ? colors.success : colors.text,
              }}
            >
              {state.word}
            </AppText>
          </>
        ) : (
          <>
            <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Partner is drawing
            </AppText>
            <AppText variant="subtitle" muted style={{ letterSpacing: 4 }}>
              {blanks}
            </AppText>
          </>
        )}
      </View>

      {/* Canvas — drawer draws, guesser watches (locked). */}
      {iAmDrawer ? (
        <ScribbleCanvas
          onLocalStroke={(s) => send({ type: 'stroke', stroke: s })}
          onClear={() => send({ type: 'clearcanvas' })}
          height={360}
        />
      ) : (
        <View pointerEvents="none">
          <ScribbleCanvas ref={canvasRef} height={360} />
        </View>
      )}

      {/* Drawer-only: skip / reveal control */}
      {iAmDrawer && state.phase === 'drawing' && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="outline" size="sm" onPress={onSkip} label="Skip / Reveal word" />
        </View>
      )}

      {/* Guesser-only: guess input */}
      {!iAmDrawer && state.phase === 'drawing' && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={guessText}
              onChangeText={setGuessText}
              onSubmitEditing={submitGuess}
              returnKeyType="send"
              placeholder="Type your guess…"
              autoCorrect={false}
            />
          </View>
          <Button variant="primary" onPress={submitGuess} disabled={!guessText.trim()} label="Guess" />
        </View>
      )}

      {/* Next round when revealed */}
      {state.phase === 'revealed' && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onNextRound} label="Next round" />
        </View>
      )}

      {/* Recent guesses */}
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          padding: 12,
          gap: 6,
        }}
      >
        <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
          Recent guesses
        </AppText>
        {state.guesses.length === 0 ? (
          <AppText variant="body" muted>No guesses yet.</AppText>
        ) : (
          <View style={{ gap: 4 }}>
            {state.guesses
              .slice()
              .reverse()
              .map((g) => (
                <View
                  key={g.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: radius.button,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: g.correct ? colors.surfaceHover : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <AppText variant="caption" muted>
                      {g.by === role ? 'You' : 'Partner'}
                    </AppText>
                    <AppText variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {g.correct ? '•••' : g.text}
                    </AppText>
                  </View>
                  <AppText
                    variant="caption"
                    weight="700"
                    style={{ color: g.correct ? colors.success : colors.error, marginLeft: 8 }}
                  >
                    {g.correct ? 'Correct!' : 'Nope'}
                  </AppText>
                </View>
              ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ScorePill({
  label,
  value,
  highlight,
}: {
  label: string;
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
      <AppText variant="caption" muted>{label}</AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
