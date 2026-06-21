import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card, Input, Touchable } from '@/components/ui';

/**
 * Emoji Riddles — the clue-giver sees a secret phrase and composes an emoji
 * clue; the guesser only ever sees the emoji clue and types guesses. Roles
 * alternate every round. HOST (role 'a') owns the authoritative state, the
 * phrase order, scores, and the secret phrase — it strips the phrase from the
 * guesser's sync view until the round is solved.
 */

/** Original phrase bank — written for this game, wholesome / PG-13. */
const PHRASES: readonly string[] = [
  'movie night on the couch',
  'pancakes for breakfast',
  'walking the dog in the rain',
  'too many tabs open',
  'a slice of pizza',
  'sunset at the beach',
  'making coffee at sunrise',
  'lost in the supermarket',
  'a road trip with snacks',
  'dancing in the kitchen',
  'binge watching a series',
  'birthday cake and candles',
  'raining cats and dogs',
  'a picnic in the park',
  'hot chocolate by the fire',
  'building a blanket fort',
  'catching the last train',
  'sharing one umbrella',
  'a love letter in the mail',
  'cooking dinner together',
  'when pigs fly',
  'butterflies in your stomach',
  'a star gazing date',
  'spilling the beans',
  'a long phone call at midnight',
  'planting a little garden',
  'baking cookies on a snow day',
  'getting lost on purpose',
  'a surprise breakfast in bed',
  'the calm before the storm',
  'two peas in a pod',
  'a weekend camping trip',
];

/** Palette of common emojis the clue-giver can tap to build a clue. */
const PALETTE: readonly string[] = [
  '❤️', '😂', '😍', '😢', '😮', '😎', '🤔', '🥳',
  '🔥', '⭐', '🌙', '☀️', '🌧️', '🍕', '🍩', '🍰',
  '☕', '🍫', '🐶', '🐱', '🐷', '🦋', '🚗', '🚂',
  '🏖️', '⛺', '🎬', '📺', '💌', '📞', '🌱', '🍪',
  '🌶️', '🥞', '🌊', '💃', '🕺', '🏠', '🌳', '✉️',
];

interface State {
  /** Whose turn it is to GIVE the clue this round. */
  giver: 'a' | 'b';
  round: number;
  scores: { a: number; b: number };
  /** The secret phrase for this round (host-owned; stripped for the guesser). */
  phrase: string | null;
  /** Emoji clue once the giver has sent it; null until sent. */
  clue: string | null;
  /** Recent guesses from the guesser (host-collected). */
  guesses: string[];
  /** True when solved or revealed; the phrase is then safe to show both sides. */
  solved: boolean;
  /** How the round ended, once over. */
  outcome: 'guessed' | 'revealed' | null;
}

const PLACEHOLDER_STATE: State = {
  giver: 'a',
  round: 1,
  scores: { a: 0, b: 0 },
  phrase: null,
  clue: null,
  guesses: [],
  solved: false,
  outcome: null,
};

/** Fisher–Yates shuffle (host-only, never in render). */
function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = a[i] as T;
    const aj = a[j] as T;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

/** Normalize a phrase/guess for comparison: trim, lowercase, collapse spaces. */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * What the GUEST is allowed to see. If the guest is the GUESSER this round and
 * the round isn't solved yet, the secret phrase is stripped so a peeking client
 * can't read it. When the guest is the clue-giver, they're allowed the phrase.
 */
function publicView(s: State): State {
  if (s.giver === 'a' && !s.solved) {
    return { ...s, phrase: null };
  }
  return s;
}

export function EmojiRiddles() {
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(PLACEHOLDER_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // HOST-only: the shuffled phrase deck and the index of the current phrase.
  const deckRef = useRef<string[]>([]);
  const deckIdxRef = useRef(0);

  // Local draft state (per-client, not synced).
  const [clueDraft, setClueDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');

  /** HOST: pull the next phrase from the deck, reshuffling if exhausted. */
  const nextPhrase = useCallback((): string => {
    if (deckRef.current.length === 0 || deckIdxRef.current >= deckRef.current.length) {
      deckRef.current = shuffle(PHRASES);
      deckIdxRef.current = 0;
    }
    const phrase = deckRef.current[deckIdxRef.current] ?? PHRASES[0] ?? '';
    deckIdxRef.current += 1;
    return phrase;
  }, []);

  /** HOST helper: send the guest its filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s) });
  }, []);

  /** HOST: start a round with a fresh phrase for the given giver. */
  const startRound = useCallback(
    (giver: 'a' | 'b', round: number, scores: { a: number; b: number }) => {
      const next: State = {
        giver,
        round,
        scores,
        phrase: nextPhrase(),
        clue: null,
        guesses: [],
        solved: false,
        outcome: null,
      };
      setState(next);
      broadcast(next);
    },
    [nextPhrase, broadcast],
  );

  /** HOST: the clue-giver submitted their emoji clue. */
  const applyClue = useCallback(
    (giver: 'a' | 'b', clue: string) => {
      const s = stateRef.current;
      if (s.giver !== giver) return;
      if (s.clue !== null || s.solved) return;
      const trimmed = clue.trim();
      if (!trimmed) return;
      const next: State = { ...s, clue: trimmed };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: the guesser submitted a guess; award + reveal on a correct match. */
  const applyGuess = useCallback(
    (guesser: 'a' | 'b', guess: string) => {
      const s = stateRef.current;
      const guesserRole = s.giver === 'a' ? 'b' : 'a';
      if (guesser !== guesserRole) return;
      if (s.clue === null || s.solved || !s.phrase) return;
      const text = guess.trim();
      if (!text) return;

      const correct = normalize(text) === normalize(s.phrase);
      const guesses = [text, ...s.guesses].slice(0, 6);

      if (correct) {
        const scores = { ...s.scores, [guesser]: s.scores[guesser] + 1 };
        const next: State = { ...s, guesses, scores, solved: true, outcome: 'guessed' };
        setState(next);
        broadcast(next);
      } else {
        const next: State = { ...s, guesses };
        setState(next);
        broadcast(next);
      }
    },
    [broadcast],
  );

  /** HOST: the clue-giver chose to skip / reveal the phrase. */
  const applyReveal = useCallback(
    (giver: 'a' | 'b') => {
      const s = stateRef.current;
      if (s.giver !== giver) return;
      if (s.solved) return;
      const next: State = { ...s, solved: true, outcome: 'revealed' };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: advance to the next round, swapping the clue-giver. */
  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (!s.solved) return;
    startRound(s.giver === 'a' ? 'b' : 'a', s.round + 1, s.scores);
  }, [startRound]);

  /** HOST: full reset (scores back to zero, role 'a' gives first). */
  const resetGame = useCallback(() => {
    deckRef.current = shuffle(PHRASES);
    deckIdxRef.current = 0;
    startRound('a', 1, { a: 0, b: 0 });
  }, [startRound]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind?: string; clue?: string; guess?: string };
      };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) {
          setState(msg.state);
          if (msg.state.clue === null) setGuessDraft('');
          if (!msg.state.solved && msg.state.clue === null) setClueDraft('');
        }
        return;
      }

      // HOST (role 'a')
      if (msg.type === 'hello') {
        broadcast(stateRef.current);
      } else if (msg.type === 'action' && msg.action) {
        const a = msg.action;
        if (a.kind === 'clue' && typeof a.clue === 'string') applyClue('b', a.clue);
        else if (a.kind === 'guess' && typeof a.guess === 'string') applyGuess('b', a.guess);
        else if (a.kind === 'reveal') applyReveal('b');
        else if (a.kind === 'next') nextRound();
      } else if (msg.type === 'reset') {
        resetGame();
      }
    },
    [broadcast, applyClue, applyGuess, applyReveal, nextRound, resetGame],
  );

  const { role, partnerHere, send } = useGameSession('emoji-riddles', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Guest announces itself so the host sends current state.
  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  // HOST seeds the first round once.
  useEffect(() => {
    if (role !== 'a') return;
    if (deckRef.current.length === 0) {
      deckRef.current = shuffle(PHRASES);
      deckIdxRef.current = 0;
      startRound('a', 1, { a: 0, b: 0 });
    }
  }, [role, startRound]);

  // HOST re-broadcasts whenever the partner (re)joins.
  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      broadcast(stateRef.current);
    }
  }, [partnerHere, role, broadcast]);

  // Clear local drafts whenever a fresh round begins.
  useEffect(() => {
    setClueDraft('');
    setGuessDraft('');
  }, [state.round]);

  const iAmGiver = state.giver === role;
  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];

  // --- Clue-giver actions ---
  const sendClue = () => {
    if (!iAmGiver || state.clue !== null || state.solved) return;
    const clue = clueDraft.trim();
    if (!clue) return;
    if (role === 'a') applyClue('a', clue);
    else send({ type: 'action', action: { kind: 'clue', clue } });
    setClueDraft('');
  };

  const revealPhrase = () => {
    if (!iAmGiver || state.solved) return;
    if (role === 'a') applyReveal('a');
    else send({ type: 'action', action: { kind: 'reveal' } });
  };

  const appendEmoji = (e: string) => setClueDraft((d) => d + e);
  const backspaceEmoji = () => setClueDraft((d) => Array.from(d).slice(0, -1).join(''));
  const clearClue = () => setClueDraft('');

  // --- Guesser actions ---
  const sendGuess = () => {
    if (iAmGiver || state.clue === null || state.solved) return;
    const guess = guessDraft.trim();
    if (!guess) return;
    if (role === 'a') applyGuess('a', guess);
    else send({ type: 'action', action: { kind: 'guess', guess } });
    setGuessDraft('');
  };

  // --- Round advance ---
  const onNext = () => {
    if (role === 'a') nextRound();
    else send({ type: 'action', action: { kind: 'next' } });
  };

  const onPlayAgain = () => {
    if (role === 'a') resetGame();
    else send({ type: 'reset' });
  };

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
          <AppText style={{ fontSize: 44 }}>🧩</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  // Mask the correct guess in the feed so it doesn't leak the answer.
  const correctGuess =
    state.solved && state.outcome === 'guessed' && state.guesses.length > 0
      ? state.guesses[0]
      : null;

  let status: string;
  let statusColor = colors.text;
  if (state.solved) {
    if (state.outcome === 'guessed') {
      const guesserRole = state.giver === 'a' ? 'b' : 'a';
      status = guesserRole === role ? 'You guessed it! 🎉' : 'Partner guessed it! 🎉';
      statusColor = colors.success;
    } else {
      status = 'Phrase revealed';
      statusColor = colors.textMuted;
    }
  } else if (iAmGiver) {
    status = state.clue === null ? 'Your turn to give the clue' : 'Clue sent · waiting for a guess…';
  } else {
    status = state.clue === null ? 'Partner is making a clue…' : 'Guess the phrase!';
    statusColor = state.clue === null ? colors.textMuted : colors.text;
  }

  return (
    <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 18 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} highlight />
        <ScorePill label="Partner" value={partnerScore} />
      </View>

      <AppText center variant="caption" muted>
        {`Round ${state.round} · `}
        <AppText variant="caption" weight="700">
          {iAmGiver ? 'You give the clue' : 'You guess'}
        </AppText>
      </AppText>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>
        {status}
      </AppText>

      {/* The phrase, shown only to the giver (or both once solved). */}
      {(iAmGiver || state.solved) && state.phrase && (
        <Card variant="elevated" style={{ alignItems: 'center' }}>
          <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {state.solved ? 'The phrase was' : 'Your secret phrase'}
          </AppText>
          <AppText variant="subtitle" style={{ marginTop: 4, color: colors.primary }} center>
            {state.phrase}
          </AppText>
        </Card>
      )}

      {/* Clue display (the emoji clue, once sent). */}
      {state.clue !== null && (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card variant="elevated" style={{ alignItems: 'center' }}>
            <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
              Clue
            </AppText>
            <AppText center style={{ marginTop: 6, fontSize: 32, lineHeight: 42 }}>
              {state.clue}
            </AppText>
          </Card>
        </Animated.View>
      )}

      {/* ===== GIVER, composing the clue ===== */}
      {iAmGiver && !state.solved && state.clue === null && (
        <View style={{ gap: 12 }}>
          <Card variant="elevated" style={{ alignItems: 'center', minHeight: 64, justifyContent: 'center' }}>
            {clueDraft ? (
              <AppText center style={{ fontSize: 32, lineHeight: 42 }}>
                {clueDraft}
              </AppText>
            ) : (
              <AppText muted center>Tap emojis to build your clue</AppText>
            )}
          </Card>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {PALETTE.map((e, i) => (
              <Touchable
                key={`${e}-${i}`}
                onPress={() => appendEmoji(e)}
                accessibilityLabel={`Add ${e}`}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.button,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                }}
              >
                <AppText style={{ fontSize: 22 }}>{e}</AppText>
              </Touchable>
            ))}
          </View>

          <Input
            value={clueDraft}
            onChangeText={setClueDraft}
            placeholder="…or type emojis here"
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            <Button variant="outline" size="sm" onPress={backspaceEmoji} label="⌫ Backspace" />
            <Button variant="ghost" size="sm" onPress={clearClue} label="Clear" />
            <Button variant="primary" size="sm" onPress={sendClue} disabled={!clueDraft.trim()} label="Send clue" />
          </View>
        </View>
      )}

      {/* ===== GIVER, clue sent, waiting ===== */}
      {iAmGiver && !state.solved && state.clue !== null && (
        <View style={{ alignItems: 'center' }}>
          <Button variant="outline" onPress={revealPhrase} label="Skip / reveal" />
        </View>
      )}

      {/* ===== GUESSER, clue available, guessing ===== */}
      {!iAmGiver && !state.solved && state.clue !== null && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              value={guessDraft}
              onChangeText={setGuessDraft}
              onSubmitEditing={sendGuess}
              returnKeyType="send"
              placeholder="Type your guess…"
            />
          </View>
          <Button variant="primary" onPress={sendGuess} disabled={!guessDraft.trim()} label="Guess" />
        </View>
      )}

      {/* Recent guesses (correct one masked so it doesn't leak). */}
      {state.guesses.length > 0 && (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Recent guesses
          </AppText>
          <View style={{ gap: 6 }}>
            {state.guesses.map((g, i) => {
              const isCorrect = g === correctGuess && i === 0;
              return (
                <View
                  key={`${i}-${g}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: radius.button,
                    borderWidth: 1,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderColor: isCorrect ? colors.success : colors.border,
                    backgroundColor: isCorrect ? colors.surfaceHover : colors.surface,
                  }}
                >
                  <AppText
                    variant="body"
                    style={{ color: isCorrect ? colors.success : colors.text }}
                  >
                    {isCorrect ? '✓ Correct!' : g}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Next round / play again controls */}
      {state.solved && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Button variant="primary" onPress={onNext} label="Next round" />
          <Button variant="ghost" onPress={onPlayAgain} label="Play again" />
        </View>
      )}
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
