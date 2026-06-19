'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji, Input } from '@/components/ui';
import { cn } from '@/lib/cn';

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
 * the masked layout + guessed letters + wrong count so they can play. The setter
 * always sees their own word.
 */
function publicView(s: State, viewer: 'a' | 'b'): State {
  const roundOver = s.phase === 'won' || s.phase === 'lost';
  const viewerIsSetter = s.setter === viewer;
  // Setter may always see their own word; guesser only once the round ends.
  if (viewerIsSetter || roundOver) return s;
  return { ...s, word: maskWord(s.word, s.guessed) };
}

export function Hangman() {
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
      if (s.setter !== player) return; // only the setter may set the word
      const word = sanitizeWord(rawWord);
      if (distinctLetters(word).length === 0) return; // need at least one letter
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
      if (player !== guesser) return; // only the guesser may guess
      const letter = letterRaw.toUpperCase();
      if (letter.length !== 1 || letter < 'A' || letter > 'Z') return;
      if (s.guessed.includes(letter)) return;

      const guessed = [...s.guessed, letter];
      const hit = s.word.includes(letter);
      const wrong = hit ? s.wrong : s.wrong + 1;

      let phase: Phase = 'playing';
      const scores = { ...s.scores };
      if (isSolved(s.word, guessed)) {
        phase = 'won'; // guesser wins
        scores[guesser] += 1;
      } else if (wrong >= MAX_WRONG) {
        phase = 'lost'; // setter wins
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

  // Clear the draft whenever a new setting phase begins for me.
  const iAmSetter = state.setter === role;
  useEffect(() => {
    if (state.phase === 'setting') setDraft('');
  }, [state.phase, state.round]);

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

  // The word to render for THIS player. The host owns the full secret, so when
  // the host happens to be the guesser (guest set the word) we must mask it
  // locally too — never trust the renderer to hide an unmasked secret. The guest
  // already receives a pre-masked view from the host; re-masking is idempotent.
  const viewWord = useMemo(() => publicView(state, role).word, [state, role]);

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="🔤" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill label="You" value={myScore} highlight />
        <ScorePill label="Partner" value={partnerScore} />
      </div>

      <p className="text-center text-sm text-text-muted">
        Round {state.round} ·{' '}
        {iAmSetter ? 'You set the word' : 'Partner set the word'}
      </p>

      {/* ===== SETTING PHASE ===== */}
      {state.phase === 'setting' &&
        (iAmSetter ? (
          <Card cardStyle="elevated" className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <Emoji emoji="✏️" size={36} />
              <p className="text-sm font-medium text-text">
                Pick a secret word or phrase
              </p>
              <p className="text-xs text-text-muted">
                Letters and spaces only · your partner can&apos;t see it
              </p>
            </div>
            <Input
              inputStyle="outlined"
              size="lg"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmWord();
              }}
              placeholder="e.g. movie night"
              aria-label="Secret word"
              autoFocus
              className="text-center tracking-wide"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                shape="pill"
                onClick={surprise}
                className="flex-1"
              >
                Surprise word
              </Button>
              <Button
                variant="primary"
                shape="pill"
                onClick={confirmWord}
                disabled={distinctLetters(sanitizeWord(draft)).length === 0}
                className="flex-1"
              >
                Start round
              </Button>
            </div>
          </Card>
        ) : (
          <Card cardStyle="elevated" className="text-center">
            <div className="flex flex-col items-center gap-3 py-8">
              <Emoji emoji="⏳" size={40} />
              <p className="text-text-muted">
                Partner is choosing a secret word…
              </p>
            </div>
          </Card>
        ))}

      {/* ===== PLAYING / ROUND-OVER ===== */}
      {state.phase !== 'setting' && (
        <>
          {/* Lives */}
          <Card cardStyle="elevated" className="flex flex-col items-center gap-2 py-4">
            <Lives wrong={state.wrong} />
            <p
              className={cn(
                'text-xs font-medium',
                livesLeft <= 2 && !roundOver ? 'text-error' : 'text-text-muted',
              )}
            >
              {roundOver
                ? `${state.wrong} wrong guess${state.wrong === 1 ? '' : 'es'}`
                : `${livesLeft} ${livesLeft === 1 ? 'life' : 'lives'} left`}
            </p>
          </Card>

          {/* Masked word */}
          <MaskedWord
            word={viewWord}
            guessed={guessedSet}
            reveal={roundOver}
            lost={state.phase === 'lost'}
          />

          {/* Result line */}
          <p
            className={cn(
              'text-center text-sm font-medium transition-colors',
              state.phase === 'won' &&
                (iAmGuesser ? 'text-success' : 'text-error'),
              state.phase === 'lost' &&
                (iAmSetter ? 'text-success' : 'text-error'),
              !roundOver && 'text-text-muted',
            )}
          >
            {state.phase === 'won'
              ? iAmGuesser
                ? 'You guessed it! 🎉'
                : 'Partner guessed your word'
              : state.phase === 'lost'
                ? iAmSetter
                  ? 'Your word stumped them! 🎉'
                  : 'Out of guesses — partner wins'
                : iAmGuesser
                  ? 'Your turn — pick a letter'
                  : 'Partner is guessing your word…'}
          </p>

          {/* Keyboard (only the guesser plays; shown disabled to the setter) */}
          {!roundOver && (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {LETTERS.map((letter) => {
                const used = guessedSet.has(letter);
                const hit = used && state.word.includes(letter);
                const miss = used && !state.word.includes(letter);
                const disabled = used || !iAmGuesser;
                return (
                  <button
                    key={letter}
                    onClick={() => guessLetter(letter)}
                    disabled={disabled}
                    aria-label={`Guess ${letter}`}
                    className={cn(
                      'flex aspect-square items-center justify-center rounded-lg border text-sm font-bold uppercase transition-all sm:text-base',
                      !used && 'border-border bg-surface text-text',
                      !used &&
                        iAmGuesser &&
                        'hover:bg-surface-hover hover:-translate-y-0.5 cursor-pointer',
                      !used && !iAmGuesser && 'opacity-50 cursor-default',
                      hit && 'border-success bg-surface-hover text-success',
                      miss && 'border-error text-error opacity-60',
                    )}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          )}

          {/* Controls */}
          {roundOver && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="primary" shape="pill" onClick={onNextRound}>
                Next round
              </Button>
              <Button variant="ghost" shape="pill" onClick={onPlayAgain}>
                Play again
              </Button>
            </div>
          )}
        </>
      )}
    </div>
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
  // `word` is either the full secret (setter / round-over) or a masked layout
  // where unguessed letters are MASK_CHAR (guesser, mid-round). A position is
  // hidden when it's still MASK_CHAR or — for the setter's full-word view — the
  // letter hasn't been guessed yet.
  const words = word.split(' ').filter((w) => w.length > 0);

  return (
    <div className="flex flex-wrap items-end justify-center gap-x-5 gap-y-3 py-2">
      {words.map((w, wi) => (
        <div key={wi} className="flex gap-1.5">
          {w.split('').map((ch, ci) => {
            const isMasked = ch === MASK_CHAR;
            const shown = reveal || (!isMasked && guessed.has(ch));
            // On a lost reveal, highlight the letters the guesser never found.
            const isMiss = reveal && lost && (isMasked || !guessed.has(ch));
            return (
              <div
                key={ci}
                className="flex w-6 flex-col items-center sm:w-7"
              >
                <span
                  className={cn(
                    'font-mono text-2xl font-bold uppercase leading-none transition-all sm:text-3xl',
                    shown
                      ? isMiss
                        ? 'text-error'
                        : 'text-text'
                      : 'text-transparent',
                  )}
                >
                  {ch}
                </span>
                <span className="mt-1 h-0.5 w-full rounded-full bg-border" />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Six-segment "lives" gallows using ▆ blocks that fill as wrong guesses mount. */
function Lives({ wrong }: { wrong: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: MAX_WRONG }, (_, i) => {
        const used = i < wrong;
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              'text-2xl leading-none transition-colors sm:text-3xl',
              used ? 'text-error' : 'text-border',
            )}
          >
            ▆
          </span>
        );
      })}
    </div>
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
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border px-2 py-2.5 text-center transition-colors',
        highlight ? 'border-primary bg-surface-hover' : 'border-border bg-surface',
      )}
    >
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
