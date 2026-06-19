'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Input } from '@/components/ui';
import {
  ScribbleCanvas,
  type ScribbleCanvasHandle,
  type RemoteScribbleStroke,
} from '@/components/creative';
import { cn } from '@/lib/cn';

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
  // Avoid repeating the immediately-previous word when possible.
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
  // Host seeds real state lazily in an effect (never during render/SSR, so the
  // random word is deterministic-free of hydration mismatches). Guests start
  // empty and fill in from the host's first sync.
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
    if (s.phase !== 'drawing') return; // round already over
    if (player === s.drawer) return; // drawer can't guess
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
        // Guest just mirrors host state.
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
          // Only the drawer may skip — guest skip is only valid when guest draws.
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
    if (s.drawer === role) return; // drawer can't guess
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
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">🎨</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">🎨</span>
          <p className="text-text-muted">Setting up the round…</p>
        </div>
      </Card>
    );
  }

  const iAmDrawer = state.drawer === role;
  const myScore = role === 'a' ? state.scores.a : state.scores.b;
  const partnerScore = role === 'a' ? state.scores.b : state.scores.a;

  let statusText: string;
  let statusTone: 'success' | 'muted' | 'normal' = 'normal';
  if (state.phase === 'revealed') {
    if (state.solved) {
      statusText = 'Guessed it! 🎉';
      statusTone = 'success';
    } else {
      statusText = 'Word revealed';
      statusTone = 'muted';
    }
  } else if (iAmDrawer) {
    statusText = "You're drawing — make them guess!";
    statusTone = 'success';
  } else {
    statusText = "Guess what they're drawing!";
    statusTone = 'normal';
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* Header: round + scores */}
      <div className="grid grid-cols-3 gap-3">
        <ScorePill label="You" value={myScore} highlight />
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-2 py-2.5 text-center">
          <span className="text-xs text-text-muted">Round</span>
          <span className="text-xl font-bold text-text">{state.round}</span>
        </div>
        <ScorePill label="Partner" value={partnerScore} />
      </div>

      {/* Status */}
      <p
        className={cn(
          'text-center text-sm font-medium text-text transition-colors',
          statusTone === 'success' && 'text-success',
          statusTone === 'muted' && 'text-text-muted',
        )}
      >
        {statusText}
      </p>

      {/* Word area */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-center">
        {iAmDrawer ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">
              Draw this
            </span>
            <span className="text-lg font-bold capitalize text-primary">
              {state.word}
            </span>
          </div>
        ) : state.phase === 'revealed' ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">
              The word was
            </span>
            <span
              className={cn(
                'text-lg font-bold capitalize',
                state.solved ? 'text-success' : 'text-text',
              )}
            >
              {state.word}
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs uppercase tracking-wide text-text-muted">
              Partner is drawing
            </span>
            <span className="font-mono text-lg tracking-[0.4em] text-text-muted">
              {state.word
                .split('')
                .map((ch) => (ch === ' ' ? '  ' : '_'))
                .join('')}
            </span>
          </div>
        )}
      </div>

      {/* Canvas — drawer draws, guesser watches (locked). The same ScribbleCanvas
          is used both ways; the guesser's is wrapped to block pointer input and
          driven via the imperative ref. */}
      {iAmDrawer ? (
        <ScribbleCanvas
          onLocalStroke={(s) => send({ type: 'stroke', stroke: s })}
          onClear={() => send({ type: 'clearcanvas' })}
          height={360}
        />
      ) : (
        <div className="pointer-events-none">
          <ScribbleCanvas ref={canvasRef} height={360} />
        </div>
      )}

      {/* Drawer-only: skip / reveal control */}
      {iAmDrawer && state.phase === 'drawing' && (
        <div className="flex justify-center">
          <Button variant="outline" shape="pill" size="sm" onClick={onSkip}>
            Skip / Reveal word
          </Button>
        </div>
      )}

      {/* Guesser-only: guess input */}
      {!iAmDrawer && state.phase === 'drawing' && (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitGuess();
          }}
        >
          <div className="flex-1">
            <Input
              value={guessText}
              onChange={(e) => setGuessText(e.target.value)}
              placeholder="Type your guess…"
              aria-label="Your guess"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="primary" shape="pill" disabled={!guessText.trim()}>
            Guess
          </Button>
        </form>
      )}

      {/* Next round when revealed */}
      {state.phase === 'revealed' && (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onNextRound}>
            Next round
          </Button>
        </div>
      )}

      {/* Recent guesses */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-text-muted">
          Recent guesses
        </span>
        {state.guesses.length === 0 ? (
          <p className="text-sm text-text-muted">No guesses yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {state.guesses
              .slice()
              .reverse()
              .map((g) => (
                <li
                  key={g.id}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm',
                    g.correct ? 'bg-surface-hover' : 'bg-transparent',
                  )}
                >
                  <span className="truncate text-text">
                    <span className="mr-2 text-xs text-text-muted">
                      {g.by === role ? 'You' : 'Partner'}
                    </span>
                    {g.correct ? '•••' : g.text}
                  </span>
                  <span
                    className={cn(
                      'ml-2 shrink-0 text-xs font-medium',
                      g.correct ? 'text-success' : 'text-error',
                    )}
                  >
                    {g.correct ? 'Correct!' : 'Nope'}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>
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
