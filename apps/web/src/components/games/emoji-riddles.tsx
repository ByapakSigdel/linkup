'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Input, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * Emoji Riddles — the clue-giver sees a secret phrase and composes an emoji
 * clue; the guesser only ever sees the emoji clue and types guesses. Roles
 * (which side is the clue-giver) alternate every round. HOST (role 'a') owns
 * the authoritative state, the phrase order, scores, and the secret phrase —
 * it strips the phrase from the guesser's sync view until the round is solved.
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
  // The guest is role 'b'. If 'b' is the guesser (giver is 'a') and not solved,
  // hide the phrase. Otherwise the guest is the giver and may see it.
  if (s.giver === 'a' && !s.solved) {
    return { ...s, phrase: null };
  }
  return s;
}

export function EmojiRiddles() {
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
          // Clear stale drafts when a fresh round arrives.
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

  // HOST seeds the first round once (deterministic placeholder until then).
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

  // Clear local drafts whenever a fresh round begins (round changes), so stale
  // text never carries across a clue-giver swap. Applies to both clients.
  useEffect(() => {
    setClueDraft('');
    setGuessDraft('');
  }, [state.round]);

  // Derived roles.
  const iAmGiver = state.giver === role;
  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="🧩" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

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
  const backspaceEmoji = () =>
    setClueDraft((d) => Array.from(d).slice(0, -1).join(''));
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

  // Mask the correct guess in the feed so it doesn't leak the answer to a
  // late-rendering observer; the solved phrase is shown separately.
  const correctGuess =
    state.solved && state.outcome === 'guessed' && state.guesses.length > 0
      ? state.guesses[0]
      : null;

  let status: string;
  let statusTone: 'normal' | 'success' | 'muted' = 'normal';
  if (state.solved) {
    if (state.outcome === 'guessed') {
      const guesserRole = state.giver === 'a' ? 'b' : 'a';
      status = guesserRole === role ? 'You guessed it! 🎉' : 'Partner guessed it! 🎉';
      statusTone = 'success';
    } else {
      status = 'Phrase revealed';
      statusTone = 'muted';
    }
  } else if (iAmGiver) {
    status =
      state.clue === null
        ? 'Your turn to give the clue'
        : 'Clue sent · waiting for a guess…';
    statusTone = 'normal';
  } else {
    status = state.clue === null ? 'Partner is making a clue…' : 'Guess the phrase!';
    statusTone = state.clue === null ? 'muted' : 'normal';
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
        <span className="font-medium text-text">
          {iAmGiver ? 'You give the clue' : 'You guess'}
        </span>
      </p>

      {/* Status */}
      <p
        className={cn(
          'text-center text-sm font-medium text-text transition-colors',
          statusTone === 'success' && 'text-success',
          statusTone === 'muted' && 'text-text-muted',
        )}
      >
        {status}
      </p>

      {/* The phrase, shown only to the giver (or both once solved). The host
          holds the full state locally, so we also gate on role here — otherwise
          the host would see the phrase while it is the guesser. */}
      {(iAmGiver || state.solved) && state.phrase && (
        <Card cardStyle="elevated" className="text-center">
          <p className="text-xs uppercase tracking-wide text-text-muted">
            {state.solved ? 'The phrase was' : 'Your secret phrase'}
          </p>
          <p className="mt-1 text-lg font-semibold text-primary">
            {state.phrase}
          </p>
        </Card>
      )}

      {/* Clue display (the emoji clue, once sent). */}
      {state.clue !== null && (
        <Card cardStyle="elevated" className="text-center">
          <p className="text-xs uppercase tracking-wide text-text-muted">Clue</p>
          <p className="mt-1 break-words text-3xl leading-relaxed">{state.clue}</p>
        </Card>
      )}

      {/* ===== GIVER, composing the clue ===== */}
      {iAmGiver && !state.solved && state.clue === null && (
        <div className="flex flex-col gap-3">
          <Card cardStyle="elevated">
            <p className="min-h-[2.5rem] break-words text-center text-3xl leading-relaxed">
              {clueDraft || (
                <span className="text-base text-text-muted">
                  Tap emojis to build your clue
                </span>
              )}
            </p>
          </Card>

          <div className="grid grid-cols-8 gap-1.5">
            {PALETTE.map((e, i) => (
              <button
                key={`${e}-${i}`}
                onClick={() => appendEmoji(e)}
                aria-label={`Add ${e}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-lg border border-border bg-surface text-xl transition-all',
                  'hover:bg-surface-hover hover:-translate-y-0.5 cursor-pointer',
                )}
              >
                <Emoji emoji={e} size={22} />
              </button>
            ))}
          </div>

          <Input
            inputStyle="filled"
            value={clueDraft}
            onChange={(ev) => setClueDraft(ev.target.value)}
            placeholder="…or type emojis here"
            aria-label="Emoji clue"
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" shape="pill" onClick={backspaceEmoji}>
              ⌫ Backspace
            </Button>
            <Button variant="ghost" size="sm" shape="pill" onClick={clearClue}>
              Clear
            </Button>
            <Button
              variant="primary"
              shape="pill"
              onClick={sendClue}
              disabled={!clueDraft.trim()}
            >
              Send clue
            </Button>
          </div>
        </div>
      )}

      {/* ===== GIVER, clue sent, waiting ===== */}
      {iAmGiver && !state.solved && state.clue !== null && (
        <div className="flex justify-center">
          <Button variant="outline" shape="pill" onClick={revealPhrase}>
            Skip / reveal
          </Button>
        </div>
      )}

      {/* ===== GUESSER, clue available, guessing ===== */}
      {!iAmGiver && !state.solved && state.clue !== null && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            sendGuess();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <Input
              inputStyle="filled"
              value={guessDraft}
              onChange={(ev) => setGuessDraft(ev.target.value)}
              placeholder="Type your guess…"
              aria-label="Your guess"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            shape="pill"
            disabled={!guessDraft.trim()}
          >
            Guess
          </Button>
        </form>
      )}

      {/* Recent guesses (correct one masked so it doesn't leak). */}
      {state.guesses.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs uppercase tracking-wide text-text-muted">
            Recent guesses
          </p>
          <div className="flex flex-col gap-1">
            {state.guesses.map((g, i) => {
              const isCorrect = g === correctGuess && i === 0;
              return (
                <div
                  key={`${i}-${g}`}
                  className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors',
                    isCorrect
                      ? 'border-success bg-surface-hover text-success'
                      : 'border-border bg-surface text-text',
                  )}
                >
                  <span className="break-words">
                    {isCorrect ? '✓ Correct!' : g}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next round / play again controls */}
      {state.solved && (
        <div className="flex justify-center gap-2">
          <Button variant="primary" shape="pill" onClick={onNext}>
            Next round
          </Button>
          <Button variant="ghost" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        </div>
      )}
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
