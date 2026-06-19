'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

interface Question {
  prompt: string;
  options: string[];
}

/** Original "all about me" prompts — the SUBJECT answers truthfully, the GUESSER guesses. */
const QUESTIONS: ReadonlyArray<Question> = [
  {
    prompt: "What's my idea of a perfect lazy Sunday?",
    options: [
      'Sleeping in then a slow brunch',
      'A long aimless walk outdoors',
      'A movie marathon under blankets',
      'Tackling a fun little project',
    ],
  },
  {
    prompt: 'Which treat would I grab first at a dessert table?',
    options: ['Dark chocolate anything', 'Warm fruit cobbler', 'Salted caramel', 'A scoop of ice cream'],
  },
  {
    prompt: 'How do I prefer to recharge after a draining day?',
    options: ['Quiet alone time', 'Venting it all out loud', 'A nap, no questions', 'Moving my body / exercise'],
  },
  {
    prompt: "What's most likely to make me laugh until it hurts?",
    options: ['A perfectly timed pun', 'Someone tripping (gently)', 'Absurd internet videos', 'An inside joke of ours'],
  },
  {
    prompt: 'If we won a free trip tomorrow, where would I want to go?',
    options: ['A beach with zero plans', 'A bustling foreign city', 'A cabin in the mountains', 'Somewhere with great food'],
  },
  {
    prompt: 'Which chore do I secretly not mind doing?',
    options: ['Washing the dishes', 'Folding warm laundry', 'Grocery shopping', 'Tidying and organizing'],
  },
  {
    prompt: "What's my go-to comfort drink?",
    options: ['A strong coffee', 'Hot tea with honey', 'Something fizzy and cold', 'Plain water, honestly'],
  },
  {
    prompt: 'How do I usually react when I get a surprise gift?',
    options: ['Happy-cry instantly', 'Big loud excitement', 'Quiet, touched smile', 'A hundred thank-yous'],
  },
  {
    prompt: 'Which sound is most soothing to me?',
    options: ['Rain on the window', 'Ocean waves', 'A crackling fire', 'Soft background music'],
  },
  {
    prompt: 'What would I rather do on a Friday night in?',
    options: ['Cook a meal together', 'Play a game or two', 'Just talk for hours', 'Binge a new show'],
  },
  {
    prompt: 'Which superpower would I pick if I had to choose?',
    options: ['Teleport anywhere', 'Read minds', 'Pause time', 'Never need sleep'],
  },
  {
    prompt: "What's my biggest tiny pet peeve?",
    options: ['Loud chewing', 'Being interrupted', 'A messy counter', 'Slow walkers ahead'],
  },
  {
    prompt: 'How do I like to spend the very first hour of the morning?',
    options: ['Slowly, no rushing', 'Straight into the day', 'Scrolling in bed', 'A warm shower first'],
  },
  {
    prompt: 'Which season feels the most "me"?',
    options: ['Cozy autumn', 'Bright summer', 'Fresh spring', 'Crisp winter'],
  },
  {
    prompt: 'What kind of compliment lands hardest for me?',
    options: ['"You\'re so thoughtful"', '"You\'re really funny"', '"You\'re so capable"', '"You make me feel safe"'],
  },
  {
    prompt: 'If our place caught fire, what would I grab (besides you)?',
    options: ['My phone', 'A sentimental keepsake', 'My wallet & keys', 'My favorite hoodie'],
  },
];

type Phase = 'answering' | 'reveal' | 'done';

interface State {
  order: number[]; // shuffled indices into QUESTIONS
  step: number; // index into `order`
  subject: 'a' | 'b'; // whose question this round is about
  /** Each player's submitted choice this round (subject = truth, guesser = guess). */
  picks: { a: number | null; b: number | null };
  phase: Phase;
  scores: { a: number; b: number }; // correct guesses per player
  lastCorrect: boolean | null; // did the guesser match last round?
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Host-only: fresh shuffled game. */
function freshState(scores: { a: number; b: number } = { a: 0, b: 0 }): State {
  return {
    order: shuffle(QUESTIONS.map((_, i) => i)),
    step: 0,
    subject: 'a',
    picks: { a: null, b: null },
    phase: 'answering',
    scores,
    lastCorrect: null,
  };
}

/** SSR-safe placeholder so render never calls Math.random. Host replaces it in an effect. */
function placeholderState(): State {
  return {
    order: QUESTIONS.map((_, i) => i),
    step: 0,
    subject: 'a',
    picks: { a: null, b: null },
    phase: 'answering',
    scores: { a: 0, b: 0 },
    lastCorrect: null,
  };
}

export function PartnerQuiz() {
  const [state, setState] = useState<State>(placeholderState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const seededRef = useRef(false);

  const sendRef = useRef<(data: unknown) => void>(() => {});

  const pushState = useCallback((next: State) => {
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  // Host: record a player's pick, then advance when both are in.
  const applyPick = useCallback(
    (player: 'a' | 'b', option: number) => {
      const s = stateRef.current;
      if (s.phase !== 'answering') return;
      if (s.picks[player] !== null) return;
      if (option < 0 || option > 3) return;

      const picks = { ...s.picks, [player]: option };
      if (picks.a === null || picks.b === null) {
        pushState({ ...s, picks });
        return;
      }

      // Both in — reveal. Guesser is the non-subject.
      const guesser: 'a' | 'b' = s.subject === 'a' ? 'b' : 'a';
      const correct = picks[guesser] === picks[s.subject];
      const scores = correct
        ? { ...s.scores, [guesser]: s.scores[guesser] + 1 }
        : s.scores;
      pushState({ ...s, picks, phase: 'reveal', scores, lastCorrect: correct });
    },
    [pushState],
  );

  // Host: advance to the next round (swap subject) or finish.
  const advance = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'reveal') return;
    const nextStep = s.step + 1;
    if (nextStep >= s.order.length) {
      pushState({ ...s, phase: 'done' });
      return;
    }
    pushState({
      ...s,
      step: nextStep,
      subject: s.subject === 'a' ? 'b' : 'a',
      picks: { a: null, b: null },
      phase: 'answering',
      lastCorrect: null,
    });
  }, [pushState]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { pick?: number; next?: boolean };
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
        if (typeof msg.action.pick === 'number') applyPick('b', msg.action.pick);
        else if (msg.action.next) advance();
      } else if (msg.type === 'reset') {
        pushState(freshState(stateRef.current.scores));
      }
    },
    [applyPick, advance, pushState],
  );

  const { role, partnerHere, send } = useGameSession('partner-quiz', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Host seeds a real shuffled game once (Math.random only here, never in render/SSR).
  useEffect(() => {
    if (role === 'a' && !seededRef.current) {
      seededRef.current = true;
      const seeded = freshState();
      setState(seeded);
      send({ type: 'sync', state: seeded });
    }
  }, [role, send]);

  // Guest announces itself so the host syncs current state.
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

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="💞" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const qIndex = state.order[state.step] ?? 0;
  const question = QUESTIONS[qIndex] ?? QUESTIONS[0]!;
  const total = state.order.length;
  const subjectIsMe = state.subject === role;
  const guesser: 'a' | 'b' = state.subject === 'a' ? 'b' : 'a';
  const myPick = state.picks[role];
  const iAnswered = myPick !== null;

  const submitPick = (option: number) => {
    if (state.phase !== 'answering' || iAnswered) return;
    if (role === 'a') applyPick('a', option);
    else send({ type: 'action', action: { pick: option } });
  };

  const onNext = () => {
    if (role === 'a') advance();
    else send({ type: 'action', action: { next: true } });
  };

  const onPlayAgain = () => {
    if (role === 'a') pushState(freshState({ a: 0, b: 0 }));
    else send({ type: 'reset' });
  };

  // ---- DONE screen ----
  if (state.phase === 'done') {
    const mine = state.scores[role];
    const theirs = state.scores[role === 'a' ? 'b' : 'a'];
    let verdict: string;
    let tone: 'success' | 'error' | 'muted';
    if (mine > theirs) {
      verdict = 'You know them best! 🎉';
      tone = 'success';
    } else if (mine < theirs) {
      verdict = 'They read you like a book 💫';
      tone = 'error';
    } else {
      verdict = "You're perfectly in sync ✨";
      tone = 'muted';
    }
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <ScorePill label={role === 'a' ? 'You' : 'Partner'} value={state.scores.a} highlight={role === 'a'} />
          <ScorePill label={role === 'b' ? 'You' : 'Partner'} value={state.scores.b} highlight={role === 'b'} />
        </div>
        <Card cardStyle="elevated" className="text-center">
          <div className="flex flex-col items-center gap-3 py-6">
            <Emoji emoji="🏆" size={48} />
            <p
              className={cn(
                'text-lg font-semibold text-text',
                tone === 'success' && 'text-success',
                tone === 'error' && 'text-error',
                tone === 'muted' && 'text-text-muted',
              )}
            >
              {verdict}
            </p>
            <p className="text-sm text-text-muted">
              You guessed {mine} of {Math.floor(total / 2) + (total % 2)} · they guessed {theirs}
            </p>
          </div>
        </Card>
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onPlayAgain}>
            Play again
          </Button>
        </div>
      </div>
    );
  }

  // ---- ROUND screen ----
  const subjectLabel =
    state.subject === role
      ? 'You'
      : 'Partner';

  let status: string;
  let statusTone: 'normal' | 'success' | 'muted' = 'normal';
  if (state.phase === 'answering') {
    if (subjectIsMe) {
      status = iAnswered ? 'Waiting for their guess…' : 'Answer truthfully about you';
    } else {
      status = iAnswered ? "Waiting for their answer…" : "Guess what they'd pick";
    }
    statusTone = iAnswered ? 'muted' : 'success';
  } else {
    status = state.lastCorrect ? 'Matched! 🎉' : 'Not quite this time';
    statusTone = state.lastCorrect ? 'success' : 'muted';
  }

  const reveal = state.phase === 'reveal';
  const truth = state.picks[state.subject];
  const guess = state.picks[guesser];

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Scoreboard */}
      <div className="grid grid-cols-2 gap-3">
        <ScorePill label={role === 'a' ? 'You' : 'Partner'} value={state.scores.a} highlight={role === 'a'} />
        <ScorePill label={role === 'b' ? 'You' : 'Partner'} value={state.scores.b} highlight={role === 'b'} />
      </div>

      {/* Round meta */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>
          Question {state.step + 1} / {total}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 font-medium text-text">
          <Emoji emoji="🔎" size={14} />
          About {subjectLabel.toLowerCase()}
        </span>
      </div>

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

      {/* Question */}
      <Card cardStyle="elevated">
        <p className="text-center text-base font-semibold text-text">{question.prompt}</p>
      </Card>

      {/* Options */}
      <div className="flex flex-col gap-2.5">
        {question.options.map((opt, i) => {
          const chosenByMe = myPick === i;
          const isTruth = reveal && truth === i;
          const isGuess = reveal && guess === i;
          const matched = reveal && truth === i && guess === i;
          const selectable = state.phase === 'answering' && !iAnswered;
          return (
            <button
              key={i}
              onClick={() => submitPick(i)}
              disabled={!selectable}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all',
                'border-border bg-surface text-text',
                selectable && 'hover:bg-surface-hover hover:border-border-focus cursor-pointer',
                !selectable && 'cursor-default',
                !reveal && chosenByMe && 'border-primary bg-surface-hover',
                matched && 'border-success bg-surface-hover text-success',
                !matched && isTruth && 'border-success bg-surface-hover',
                !matched && isGuess && 'border-border-focus bg-surface-hover',
              )}
            >
              <span>{opt}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {!reveal && chosenByMe && <Emoji emoji="✅" size={16} />}
                {reveal && isTruth && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-success">
                    Truth
                  </span>
                )}
                {reveal && isGuess && !matched && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                    Guess
                  </span>
                )}
                {matched && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-success">
                    Match
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reveal caption */}
      {reveal && (
        <p className="text-center text-xs text-text-muted">
          {guesser === role
            ? state.lastCorrect
              ? 'You guessed it right — +1 for you!'
              : 'Your guess and their truth differed.'
            : state.lastCorrect
              ? 'They read you perfectly — +1 for them!'
              : 'They guessed differently this round.'}
        </p>
      )}

      {/* Controls */}
      {reveal && (
        <div className="flex justify-center">
          <Button variant="primary" shape="pill" onClick={onNext}>
            {state.step + 1 >= total ? 'See results' : 'Next question'}
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
      <span className="text-xs text-text-muted">{label} · correct guesses</span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}
