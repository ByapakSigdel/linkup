import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card, Input, Touchable } from '@/components/ui';

const MAX_WRONG = 6;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Original wholesome everyday / couple words for the "Surprise word" button. */
const SURPRISE_WORDS: readonly string[] = [
  'MORNING COFFEE',
  'SLOW DANCE',
  'BLANKET FORT',
  'ROAD TRIP',
  'WARM HUGS',
  'MOVIE NIGHT',
  'SUNDAY BRUNCH',
  'STARGAZING',
  'HANDWRITTEN NOTE',
  'GENTLE RAIN',
  'CINNAMON ROLL',
  'PILLOW TALK',
  'GARDEN WALK',
  'FAIRY LIGHTS',
  'INSIDE JOKE',
  'BUTTERFLIES',
  'PINKY PROMISE',
  'COZY SWEATER',
  'BEACH SUNSET',
  'MAPLE SYRUP',
  'PAPER CRANE',
  'LATE BREAKFAST',
  'FOREHEAD KISS',
  'PUPPY EYES',
  'HONEY MOON',
  'PICNIC BASKET',
  'CANDLE GLOW',
  'SOFT WHISPER',
  'LAZY SUNDAY',
  'SHOOTING STAR',
];

type Phase = 'setting' | 'playing' | 'won' | 'lost';

/** Authoritative state owned by the HOST (role 'a'). Holds the secret word. */
interface State {
  /** Who sets the word this round; the other player guesses. */
  setter: 'a' | 'b';
  phase: Phase;
  /** Secret word/phrase, uppercase A-Z + spaces. Stripped from the guesser's view. */
  word: string;
  /** Letters guessed so far (uppercase). */
  guessed: string[];
  wrong: number;
  scores: { a: number; b: number };
  round: number;
}

function initialState(): State {
  return {
    setter: 'a',
    phase: 'setting',
    word: '',
    guessed: [],
    wrong: 0,
    scores: { a: 0, b: 0 },
    round: 1,
  };
}

/** Sanitize a typed word to A-Z + single spaces, uppercase. */
function sanitizeWord(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Count distinct letters in a word (ignoring spaces). */
function distinctLetters(word: string): string[] {
  const set = new Set<string>();
  for (const ch of word) {
    if (ch !== ' ') set.add(ch);
  }
  return [...set];
}

/** Has every letter of the word been guessed? */
function isSolved(word: string, guessed: string[]): boolean {
  const g = new Set(guessed);
  return distinctLetters(word).every((l) => g.has(l));
}

/** Placeholder char for an unrevealed letter — preserves word length/layout. */
const MASK_CHAR = '·'; // middle dot, never a real A-Z letter

/**
 * Mask the secret so the guesser learns the LAYOUT (lengths + spaces) and any
 * correctly-guessed letters, but never the unguessed letters themselves.
 */
function maskWord(word: string, guessed: string[]): string {
  const g = new Set(guessed);
  return word
    .split('')
    .map((ch) => (ch === ' ' ? ' ' : g.has(ch) ? ch : MASK_CHAR))
    .join('');
}

/**
 * What a given viewer is allowed to see. The host hides the unguessed letters of
 * the secret word from the GUESSER until the round is over, while always sending
 * the masked layout + guessed letters + wrong count so they can play.
 */
function publicView(s: State, viewer: 'a' | 'b'): State {
  const roundOver = s.phase === 'won' || s.phase === 'lost';
  const viewerIsSetter = s.setter === viewer;
  if (viewerIsSetter || roundOver) return s;
  return { ...s, word: maskWord(s.word, s.guessed) };
}

export function Hangman() {
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Local draft for the setter's word entry (never sent until confirmed).
  const [draft, setDraft] = useState('');

  /** HOST helper: send each side its own filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

  /** HOST: record the chosen word and begin play. */
  const applySetWord = useCallback(
    (player: 'a' | 'b', rawWord: string) => {
      const s = stateRef.current;
      if (s.phase !== 'setting') return;
      if (s.setter !== player) return;
      const word = sanitizeWord(rawWord);
      if (distinctLetters(word).length === 0) return;
      const next: State = { ...s, word, phase: 'playing' };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: register a letter guess from the guesser. */
  const applyGuess = useCallback(
    (player: 'a' | 'b', letterRaw: string) => {
      const s = stateRef.current;
      if (s.phase !== 'playing') return;
      const guesser = s.setter === 'a' ? 'b' : 'a';
      if (player !== guesser) return;
      const letter = letterRaw.toUpperCase();
      if (letter.length !== 1 || letter < 'A' || letter > 'Z') return;
      if (s.guessed.includes(letter)) return;

      const guessed = [...s.guessed, letter];
      const hit = s.word.includes(letter);
      const wrong = hit ? s.wrong : s.wrong + 1;

      let phase: Phase = 'playing';
      const scores = { ...s.scores };
      if (isSolved(s.word, guessed)) {
        phase = 'won';
        scores[guesser] += 1;
      } else if (wrong >= MAX_WRONG) {
        phase = 'lost';
        scores[s.setter] += 1;
      }

      const next: State = { ...s, guessed, wrong, phase, scores };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: swap setter and start a fresh round (keep scores). */
  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'won' && s.phase !== 'lost') return;
    const next: State = {
      ...s,
      setter: s.setter === 'a' ? 'b' : 'a',
      phase: 'setting',
      word: '',
      guessed: [],
      wrong: 0,
      round: s.round + 1,
    };
    setState(next);
    broadcast(next);
  }, [broadcast]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind?: string; word?: string; letter?: string };
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
        const a = msg.action;
        if (a.kind === 'set' && typeof a.word === 'string') {
          applySetWord('b', a.word);
        } else if (a.kind === 'guess' && typeof a.letter === 'string') {
          applyGuess('b', a.letter);
        } else if (a.kind === 'next') {
          nextRound();
        }
      } else if (msg.type === 'reset') {
        const next = initialState();
        setState(next);
        broadcast(next);
      }
    },
    [applySetWord, applyGuess, nextRound, broadcast],
  );

  const { role, partnerHere, send } = useGameSession('hangman', handleMessage);
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

  // Clear the draft whenever a new setting phase begins.
  useEffect(() => {
    if (state.phase === 'setting') setDraft('');
  }, [state.phase, state.round]);

  const iAmSetter = state.setter === role;

  // ---- Actions wired through host-authoritative sync ----
  const confirmWord = () => {
    if (!partnerHere || state.phase !== 'setting' || !iAmSetter) return;
    const clean = sanitizeWord(draft);
    if (distinctLetters(clean).length === 0) return;
    if (role === 'a') applySetWord('a', clean);
    else send({ type: 'action', action: { kind: 'set', word: clean } });
  };

  const surprise = () => {
    const idx = Math.floor(Math.random() * SURPRISE_WORDS.length);
    const w = SURPRISE_WORDS[idx] ?? SURPRISE_WORDS[0] ?? 'MOVIE NIGHT';
    setDraft(w);
  };

  const guessLetter = (letter: string) => {
    if (!partnerHere || state.phase !== 'playing' || iAmSetter) return;
    if (state.guessed.includes(letter)) return;
    if (role === 'a') applyGuess('a', letter);
    else send({ type: 'action', action: { kind: 'guess', letter } });
  };

  const onNextRound = () => {
    if (role === 'a') nextRound();
    else send({ type: 'action', action: { kind: 'next' } });
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

  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];
  const guesserRole: 'a' | 'b' = state.setter === 'a' ? 'b' : 'a';
  const iAmGuesser = guesserRole === role;
  const roundOver = state.phase === 'won' || state.phase === 'lost';

  const guessedSet = useMemo(() => new Set(state.guessed), [state.guessed]);
  const livesLeft = MAX_WRONG - state.wrong;

  const viewWord = useMemo(() => publicView(state, role).word, [state, role]);

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 40 }}>
          <AppText style={{ fontSize: 44 }}>🔤</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  // Result line text + tone.
  let resultText: string;
  let resultColor = colors.textMuted;
  if (state.phase === 'won') {
    resultText = iAmGuesser ? 'You guessed it! 🎉' : 'Partner guessed your word';
    resultColor = iAmGuesser ? colors.success : colors.error;
  } else if (state.phase === 'lost') {
    resultText = iAmSetter ? 'Your word stumped them! 🎉' : 'Out of guesses — partner wins';
    resultColor = iAmSetter ? colors.success : colors.error;
  } else {
    resultText = iAmGuesser ? 'Your turn — pick a letter' : 'Partner is guessing your word…';
  }

  return (
    <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: 18 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} highlight />
        <ScorePill label="Partner" value={partnerScore} />
      </View>

      <AppText center variant="caption" muted>
        {`Round ${state.round} · ${iAmSetter ? 'You set the word' : 'Partner set the word'}`}
      </AppText>

      {/* ===== SETTING PHASE ===== */}
      {state.phase === 'setting' &&
        (iAmSetter ? (
          <Card variant="elevated" style={{ gap: 14 }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <AppText style={{ fontSize: 36 }}>✏️</AppText>
              <AppText variant="label">Pick a secret word or phrase</AppText>
              <AppText variant="caption" muted center>
                Letters and spaces only · your partner can&apos;t see it
              </AppText>
            </View>
            <Input
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={confirmWord}
              returnKeyType="done"
              autoCapitalize="characters"
              placeholder="e.g. movie night"
              style={{ textAlign: 'center', letterSpacing: 1 }}
            />
            <View style={{ gap: 8 }}>
              <Button variant="secondary" onPress={surprise} label="Surprise word" />
              <Button
                variant="primary"
                onPress={confirmWord}
                disabled={distinctLetters(sanitizeWord(draft)).length === 0}
                label="Start round"
              />
            </View>
          </Card>
        ) : (
          <Card variant="elevated" style={{ alignItems: 'center' }}>
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
              <AppText style={{ fontSize: 40 }}>⏳</AppText>
              <AppText muted>Partner is choosing a secret word…</AppText>
            </View>
          </Card>
        ))}

      {/* ===== PLAYING / ROUND-OVER ===== */}
      {state.phase !== 'setting' && (
        <>
          {/* Lives */}
          <Card variant="elevated" style={{ alignItems: 'center', gap: 8 }}>
            <Lives wrong={state.wrong} />
            <AppText
              variant="caption"
              style={{
                fontWeight: '600',
                color: livesLeft <= 2 && !roundOver ? colors.error : colors.textMuted,
              }}
            >
              {roundOver
                ? `${state.wrong} wrong guess${state.wrong === 1 ? '' : 'es'}`
                : `${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left`}
            </AppText>
          </Card>

          {/* Masked word */}
          <MaskedWord
            word={viewWord}
            guessed={guessedSet}
            reveal={roundOver}
            lost={state.phase === 'lost'}
          />

          {/* Result line */}
          <Animated.View key={resultText} entering={FadeIn.duration(300)}>
            <AppText center variant="label" style={{ color: resultColor }}>
              {resultText}
            </AppText>
          </Animated.View>

          {/* Keyboard (only the guesser plays; shown disabled to the setter) */}
          {!roundOver && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {LETTERS.map((letter) => {
                const used = guessedSet.has(letter);
                const hit = used && state.word.includes(letter);
                const miss = used && !state.word.includes(letter);
                const disabled = used || !iAmGuesser;
                const borderColor = hit
                  ? colors.success
                  : miss
                    ? colors.error
                    : colors.border;
                const textColor = hit
                  ? colors.success
                  : miss
                    ? colors.error
                    : colors.text;
                return (
                  <Touchable
                    key={letter}
                    onPress={() => guessLetter(letter)}
                    disabled={disabled}
                    accessibilityLabel={`Guess ${letter}`}
                    style={{
                      width: 38,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.button,
                      borderWidth: 1,
                      borderColor,
                      backgroundColor: hit ? colors.surfaceHover : colors.surface,
                      opacity: !used && !iAmGuesser ? 0.5 : miss ? 0.6 : 1,
                    }}
                  >
                    <AppText weight="800" style={{ color: textColor, fontSize: 16 }}>
                      {letter}
                    </AppText>
                  </Touchable>
                );
              })}
            </View>
          )}

          {/* Controls */}
          {roundOver && (
            <View style={{ gap: 8 }}>
              <Button variant="primary" onPress={onNextRound} label="Next round" />
              <Button variant="ghost" onPress={onPlayAgain} label="Play again" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

/** Big masked-word display: underscores per unrevealed letter, spaces as gaps. */
function MaskedWord({
  word,
  guessed,
  reveal,
  lost,
}: {
  word: string;
  guessed: Set<string>;
  reveal: boolean;
  lost: boolean;
}) {
  const { colors } = useTheme();
  const words = word.split(' ').filter((w) => w.length > 0);

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'center',
        columnGap: 20,
        rowGap: 12,
        paddingVertical: 4,
      }}
    >
      {words.map((w, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: 6 }}>
          {w.split('').map((ch, ci) => {
            const isMasked = ch === MASK_CHAR;
            const shown = reveal || (!isMasked && guessed.has(ch));
            const isMiss = reveal && lost && (isMasked || !guessed.has(ch));
            return (
              <View key={ci} style={{ width: 26, alignItems: 'center' }}>
                <AppText
                  style={{
                    fontSize: 28,
                    fontWeight: '800',
                    lineHeight: 32,
                    color: shown ? (isMiss ? colors.error : colors.text) : 'transparent',
                  }}
                >
                  {ch === MASK_CHAR ? '?' : ch}
                </AppText>
                <View
                  style={{
                    marginTop: 4,
                    height: 2,
                    width: '100%',
                    borderRadius: 1,
                    backgroundColor: colors.border,
                  }}
                />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Six-segment "lives" gallows using ▆ blocks that fill as wrong guesses mount. */
function Lives({ wrong }: { wrong: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: MAX_WRONG }, (_, i) => {
        const used = i < wrong;
        return (
          <AppText
            key={i}
            style={{ fontSize: 28, lineHeight: 30, color: used ? colors.error : colors.border }}
          >
            ▆
          </AppText>
        );
      })}
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
