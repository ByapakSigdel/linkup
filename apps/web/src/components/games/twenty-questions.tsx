'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Input, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

const MAX_QUESTIONS = 20;

/** Original, wholesome prompt ideas for the thinker. */
const IDEA_PROMPTS: readonly string[] = [
  'A lighthouse on a stormy coast',
  'The smell of fresh popcorn',
  'A grandmother who knits sweaters',
  'A rollercoaster at a seaside fair',
  'The first snowfall of winter',
  'A juggling street performer',
  'A cozy bookstore cat',
  'The Northern Lights over a frozen lake',
  'A hot air balloon at sunrise',
  'A vinyl record spinning slowly',
  'A treehouse with a rope ladder',
  'The taste of homemade lemonade',
  'A retired sea captain',
  'A field of sunflowers at noon',
  'A clumsy but loyal puppy',
  'An old grandfather clock ticking',
  'A campfire under a starry sky',
  'A pair of well-worn hiking boots',
  'The sound of rain on a tin roof',
  'A magician pulling a rabbit from a hat',
];

type Answer = 'yes' | 'no' | 'sortof' | 'doesntmatter';

interface QA {
  /** Who asked: always the guesser, kept for clarity in the log. */
  question: string;
  answer: Answer | null;
}

type Phase = 'setup' | 'asking' | 'answering' | 'judging' | 'ended';

/** Authoritative state owned by the HOST (role 'a'). */
interface State {
  /** Which role is the THINKER this round. */
  thinker: 'a' | 'b';
  /** The secret answer. Host-only; stripped from the guesser's view. */
  secret: string;
  phase: Phase;
  log: QA[];
  /** Question text awaiting an answer, or null. */
  pending: string | null;
  /** Final guess awaiting a verdict, or null. */
  finalGuess: string | null;
  /** Who won the round once ended, plus how it ended. */
  result: { winner: 'a' | 'b'; reason: 'correct' | 'incorrect' | 'outofquestions' } | null;
  round: number;
  /** Rounds won by each role. */
  scores: { a: number; b: number };
  /** Fewest questions used in a correct guess (tiebreak). */
  bestQuestions: { a: number | null; b: number | null };
}

function initialState(): State {
  return {
    thinker: 'a',
    secret: '',
    phase: 'setup',
    log: [],
    pending: null,
    finalGuess: null,
    result: null,
    round: 1,
    scores: { a: 0, b: 0 },
    bestQuestions: { a: null, b: null },
  };
}

/** Questions answered so far (counts toward the 20 limit). */
function answeredCount(log: QA[]): number {
  return log.filter((q) => q.answer !== null).length;
}

/**
 * What a viewer is allowed to see. The secret is only ever revealed to the
 * thinker, or to everyone once the round has ended.
 */
function publicView(s: State, viewer: 'a' | 'b'): State {
  const canSee = viewer === s.thinker || s.phase === 'ended';
  if (canSee) return s;
  return { ...s, secret: '' };
}

const ANSWER_LABELS: Record<Answer, string> = {
  yes: 'Yes',
  no: 'No',
  sortof: 'Sort of',
  doesntmatter: "Doesn't matter",
};

const ANSWER_OPTIONS: readonly Answer[] = ['yes', 'no', 'sortof', 'doesntmatter'];

export function TwentyQuestions() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  // Local-only input fields (never part of authoritative state).
  const [secretDraft, setSecretDraft] = useState('');
  const [questionDraft, setQuestionDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');

  const logEndRef = useRef<HTMLDivElement | null>(null);

  /** HOST helper: send each side its own filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

  /** HOST: thinker locks in the secret and play begins. */
  const applySetSecret = useCallback(
    (player: 'a' | 'b', secret: string) => {
      const s = stateRef.current;
      if (s.phase !== 'setup') return;
      if (player !== s.thinker) return;
      const clean = secret.trim();
      if (!clean) return;
      const next: State = { ...s, secret: clean, phase: 'asking' };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: guesser submits a yes/no question. */
  const applyAskQuestion = useCallback(
    (player: 'a' | 'b', question: string) => {
      const s = stateRef.current;
      if (s.phase !== 'asking') return;
      if (player === s.thinker) return; // only the guesser asks
      if (answeredCount(s.log) >= MAX_QUESTIONS) return;
      const clean = question.trim();
      if (!clean) return;
      const next: State = {
        ...s,
        phase: 'answering',
        pending: clean,
        log: [...s.log, { question: clean, answer: null }],
      };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: thinker answers the pending question. */
  const applyAnswer = useCallback(
    (player: 'a' | 'b', answer: Answer) => {
      const s = stateRef.current;
      if (s.phase !== 'answering') return;
      if (player !== s.thinker) return;
      if (s.pending === null || s.log.length === 0) return;

      const log = s.log.slice();
      const lastIdx = log.length - 1;
      const last = log[lastIdx];
      if (!last) return;
      log[lastIdx] = { ...last, answer };

      const used = answeredCount(log);
      // Running out of questions -> thinker wins, reveal the answer.
      if (used >= MAX_QUESTIONS) {
        const scores = { ...s.scores, [s.thinker]: s.scores[s.thinker] + 1 };
        const next: State = {
          ...s,
          log,
          pending: null,
          phase: 'ended',
          result: { winner: s.thinker, reason: 'outofquestions' },
          scores,
        };
        setState(next);
        broadcast(next);
        return;
      }

      const next: State = { ...s, log, pending: null, phase: 'asking' };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: guesser makes a final guess. */
  const applyFinalGuess = useCallback(
    (player: 'a' | 'b', guess: string) => {
      const s = stateRef.current;
      if (s.phase !== 'asking' && s.phase !== 'answering') return;
      if (player === s.thinker) return;
      const clean = guess.trim();
      if (!clean) return;
      const next: State = { ...s, phase: 'judging', finalGuess: clean };
      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: thinker judges the final guess. */
  const applyVerdict = useCallback(
    (player: 'a' | 'b', correct: boolean) => {
      const s = stateRef.current;
      if (s.phase !== 'judging') return;
      if (player !== s.thinker) return;

      const guesser: 'a' | 'b' = s.thinker === 'a' ? 'b' : 'a';
      const used = answeredCount(s.log);

      if (correct) {
        const scores = { ...s.scores, [guesser]: s.scores[guesser] + 1 };
        const prevBest = s.bestQuestions[guesser];
        const bestQuestions = {
          ...s.bestQuestions,
          [guesser]: prevBest === null ? used : Math.min(prevBest, used),
        };
        const next: State = {
          ...s,
          phase: 'ended',
          result: { winner: guesser, reason: 'correct' },
          scores,
          bestQuestions,
        };
        setState(next);
        broadcast(next);
      } else {
        // Incorrect final guess -> thinker wins the round.
        const scores = { ...s.scores, [s.thinker]: s.scores[s.thinker] + 1 };
        const next: State = {
          ...s,
          phase: 'ended',
          finalGuess: null,
          result: { winner: s.thinker, reason: 'incorrect' },
          scores,
        };
        setState(next);
        broadcast(next);
      }
    },
    [broadcast],
  );

  /** HOST: start the next round, swapping roles. */
  const applyNextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'ended') return;
    const next: State = {
      ...s,
      thinker: s.thinker === 'a' ? 'b' : 'a',
      secret: '',
      phase: 'setup',
      log: [],
      pending: null,
      finalGuess: null,
      result: null,
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
        action?: {
          kind?: string;
          secret?: string;
          question?: string;
          answer?: Answer;
          guess?: string;
          correct?: boolean;
        };
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
        switch (a.kind) {
          case 'secret':
            if (a.secret !== undefined) applySetSecret('b', a.secret);
            break;
          case 'ask':
            if (a.question !== undefined) applyAskQuestion('b', a.question);
            break;
          case 'answer':
            if (a.answer !== undefined) applyAnswer('b', a.answer);
            break;
          case 'final':
            if (a.guess !== undefined) applyFinalGuess('b', a.guess);
            break;
          case 'verdict':
            if (a.correct !== undefined) applyVerdict('b', a.correct);
            break;
          case 'next':
            applyNextRound();
            break;
        }
      } else if (msg.type === 'reset') {
        const cur = stateRef.current;
        const next: State = {
          ...initialState(),
          // Keep alternation continuity but a full reset zeroes scores.
          thinker: cur.thinker,
        };
        setState(next);
        broadcast(next);
      }
    },
    [
      broadcast,
      applySetSecret,
      applyAskQuestion,
      applyAnswer,
      applyFinalGuess,
      applyVerdict,
      applyNextRound,
    ],
  );

  const { role, partnerHere, send } = useGameSession(
    'twenty-questions',
    handleMessage,
  );
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

  // Clear local drafts whenever the round/phase context resets.
  useEffect(() => {
    setQuestionDraft('');
    setGuessDraft('');
  }, [state.round]);
  useEffect(() => {
    if (state.phase === 'setup') setSecretDraft('');
  }, [state.phase, state.round]);

  // Keep the Q&A log scrolled to the latest entry.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.log.length, state.pending, state.phase]);

  // ----- Action dispatchers (host applies directly, guest sends) -----
  const isThinker = role === state.thinker;
  const guesserRole: 'a' | 'b' = state.thinker === 'a' ? 'b' : 'a';

  const dispatch = (
    hostFn: () => void,
    action: Record<string, unknown>,
  ) => {
    if (role === 'a') hostFn();
    else send({ type: 'action', action });
  };

  const onSetSecret = () => {
    const clean = secretDraft.trim();
    if (!clean) return;
    dispatch(() => applySetSecret('a', clean), { kind: 'secret', secret: clean });
  };

  const onSuggestIdea = () => {
    // Idea suggestion is purely a local convenience for the thinker; no
    // randomness leaves this client, so it stays SSR-safe (effect/event only).
    const idx = Math.floor(Math.random() * IDEA_PROMPTS.length);
    const pick = IDEA_PROMPTS[idx] ?? IDEA_PROMPTS[0] ?? '';
    setSecretDraft(pick);
  };

  const onAsk = () => {
    const clean = questionDraft.trim();
    if (!clean) return;
    dispatch(() => applyAskQuestion('a', clean), { kind: 'ask', question: clean });
    setQuestionDraft('');
  };

  const onAnswer = (answer: Answer) => {
    dispatch(() => applyAnswer('a', answer), { kind: 'answer', answer });
  };

  const onFinalGuess = () => {
    const clean = guessDraft.trim();
    if (!clean) return;
    dispatch(() => applyFinalGuess('a', clean), { kind: 'final', guess: clean });
    setGuessDraft('');
  };

  const onVerdict = (correct: boolean) => {
    dispatch(() => applyVerdict('a', correct), { kind: 'verdict', correct });
  };

  const onNextRound = () => {
    dispatch(() => applyNextRound(), { kind: 'next' });
  };

  const onPlayAgain = () => {
    if (role === 'a') {
      const next: State = { ...initialState(), thinker: state.thinker };
      setState(next);
      broadcast(next);
    } else {
      send({ type: 'reset' });
    }
  };

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="💭" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const used = answeredCount(state.log);
  const remaining = MAX_QUESTIONS - used;
  const myScore = state.scores[role];
  const partnerScore = state.scores[guesserRole === role ? state.thinker : guesserRole];

  // Banner describing the current phase from this player's perspective.
  let banner: string;
  if (state.phase === 'setup') {
    banner = isThinker
      ? 'You are the Thinker — pick something to be guessed'
      : 'Your partner is choosing something…';
  } else if (state.phase === 'ended') {
    banner = state.result?.winner === role ? 'You won this round! 🎉' : 'Partner won this round';
  } else {
    banner = isThinker
      ? 'You are the Thinker — answer the questions'
      : 'You are the Guesser — narrow it down';
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-3">
        <ScorePill
          label="You"
          value={myScore}
          best={state.bestQuestions[role]}
          highlight
        />
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-2 py-2.5 text-center">
          <span className="text-xs text-text-muted">Round</span>
          <span className="text-xl font-bold text-text">{state.round}</span>
        </div>
        <ScorePill
          label="Partner"
          value={partnerScore}
          best={state.bestQuestions[guesserRole === role ? state.thinker : guesserRole]}
        />
      </div>

      {/* Role / phase banner */}
      <div
        className={cn(
          'rounded-xl border px-4 py-3 text-center text-sm font-medium transition-colors',
          state.phase === 'ended'
            ? state.result?.winner === role
              ? 'border-success bg-surface-hover text-success'
              : 'border-error bg-surface text-error'
            : 'border-border bg-surface text-text',
        )}
      >
        {banner}
        {state.phase !== 'setup' && state.phase !== 'ended' && (
          <span
            className={cn(
              'ml-2 font-semibold',
              remaining <= 5 ? 'text-error' : 'text-text-muted',
            )}
          >
            · {remaining} {remaining === 1 ? 'question' : 'questions'} left
          </span>
        )}
      </div>

      {/* Q&A log */}
      {(state.log.length > 0 || state.phase !== 'setup') && (
        <Card cardStyle="bordered" className="p-0">
          <div className="max-h-64 overflow-y-auto px-4 py-3">
            {state.log.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">
                No questions yet — the guesser goes first.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {state.log.map((qa, i) => (
                  <li key={i} className="flex flex-col gap-1">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-xs font-semibold text-text-muted">
                        Q{i + 1}
                      </span>
                      <span className="flex-1 text-sm text-text">{qa.question}</span>
                    </div>
                    {qa.answer && (
                      <div className="ml-7">
                        <AnswerBadge answer={qa.answer} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            <div ref={logEndRef} />
          </div>
        </Card>
      )}

      {/* Secret display for the thinker (their own client only) */}
      {isThinker && state.phase !== 'setup' && state.secret && (
        <p className="text-center text-sm text-text-muted">
          Your secret:{' '}
          <span className="font-semibold text-primary">{state.secret}</span>
        </p>
      )}

      {/* ===== Phase controls ===== */}

      {/* SETUP: thinker picks the secret */}
      {state.phase === 'setup' && isThinker && (
        <div className="flex flex-col gap-3">
          <Input
            value={secretDraft}
            onChange={(e) => setSecretDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSetSecret();
            }}
            placeholder="A person, place, or thing…"
            aria-label="Secret answer"
            maxLength={80}
            autoFocus
          />
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" shape="pill" onClick={onSuggestIdea} type="button">
              💡 Need an idea?
            </Button>
            <Button
              variant="primary"
              shape="pill"
              onClick={onSetSecret}
              disabled={!secretDraft.trim()}
            >
              Start round
            </Button>
          </div>
        </div>
      )}

      {state.phase === 'setup' && !isThinker && (
        <Card cardStyle="elevated" className="text-center">
          <div className="flex flex-col items-center gap-2 py-6">
            <Emoji emoji="💭" size={36} />
            <p className="text-text-muted">Your partner is thinking of something…</p>
          </div>
        </Card>
      )}

      {/* ASKING: guesser types a question OR makes a final guess */}
      {state.phase === 'asking' && !isThinker && (
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                value={questionDraft}
                onChange={(e) => setQuestionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onAsk();
                }}
                placeholder="Ask a yes/no question…"
                aria-label="Your question"
                maxLength={120}
              />
            </div>
            <Button
              variant="primary"
              shape="pill"
              onClick={onAsk}
              disabled={!questionDraft.trim()}
            >
              Ask
            </Button>
          </div>
          <FinalGuessRow
            value={guessDraft}
            onChange={setGuessDraft}
            onSubmit={onFinalGuess}
          />
        </div>
      )}

      {state.phase === 'asking' && isThinker && (
        <p className="text-center text-sm text-text-muted">
          Waiting for your partner to ask a question…
        </p>
      )}

      {/* ANSWERING: thinker answers the pending question */}
      {state.phase === 'answering' && isThinker && state.pending && (
        <div className="flex flex-col gap-3">
          <Card cardStyle="elevated">
            <p className="text-center text-sm text-text">
              <span className="text-text-muted">They asked:</span>{' '}
              <span className="font-medium">{state.pending}</span>
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ANSWER_OPTIONS.map((opt) => (
              <Button
                key={opt}
                variant="secondary"
                shape="pill"
                onClick={() => onAnswer(opt)}
                className="w-full"
              >
                {ANSWER_LABELS[opt]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {state.phase === 'answering' && !isThinker && (
        <p className="text-center text-sm text-text-muted">
          Waiting for your partner to answer…
        </p>
      )}

      {/* JUDGING: thinker marks the final guess */}
      {state.phase === 'judging' && (
        <Card cardStyle="elevated" className="flex flex-col gap-3">
          <p className="text-center text-sm text-text">
            <span className="text-text-muted">Final guess:</span>{' '}
            <span className="font-semibold">{state.finalGuess}</span>
          </p>
          {isThinker ? (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="primary" shape="pill" onClick={() => onVerdict(true)}>
                ✅ Correct
              </Button>
              <Button variant="secondary" shape="pill" onClick={() => onVerdict(false)}>
                ❌ Incorrect
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-text-muted">
              Waiting for your partner to judge your guess…
            </p>
          )}
        </Card>
      )}

      {/* ENDED: reveal + result + next round */}
      {state.phase === 'ended' && (
        <div className="flex flex-col gap-3">
          <Card cardStyle="elevated" className="text-center">
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-sm text-text-muted">
                {state.result?.reason === 'correct'
                  ? `Guessed in ${used} ${used === 1 ? 'question' : 'questions'}!`
                  : state.result?.reason === 'outofquestions'
                    ? 'Out of questions!'
                    : 'Wrong final guess!'}
              </p>
              <p className="text-base text-text">
                The answer was{' '}
                <span className="font-semibold text-primary">{state.secret}</span>
              </p>
            </div>
          </Card>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="primary" shape="pill" onClick={onNextRound}>
              Next round (swap roles)
            </Button>
            <Button variant="ghost" shape="pill" onClick={onPlayAgain}>
              Reset scores
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FinalGuessRow({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex items-end gap-2 border-t border-border pt-3">
      <div className="flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          inputStyle="filled"
          placeholder="Ready to guess? Type your answer…"
          aria-label="Final guess"
          maxLength={80}
        />
      </div>
      <Button
        variant="secondary"
        shape="pill"
        onClick={onSubmit}
        disabled={!value.trim()}
      >
        Final guess
      </Button>
    </div>
  );
}

function AnswerBadge({ answer }: { answer: Answer }) {
  const tone =
    answer === 'yes'
      ? 'border-success text-success'
      : answer === 'no'
        ? 'border-error text-error'
        : 'border-border text-text-muted';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tone,
      )}
    >
      {ANSWER_LABELS[answer]}
    </span>
  );
}

function ScorePill({
  label,
  value,
  best,
  highlight,
}: {
  label: string;
  value: number;
  best: number | null;
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
      {best !== null && (
        <span className="text-[10px] text-text-muted">best {best}Q</span>
      )}
    </div>
  );
}
