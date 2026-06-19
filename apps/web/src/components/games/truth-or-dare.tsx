'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Original sweet/curious truths for partners. */
const TRUTHS: readonly string[] = [
  'What tiny thing do I do that always makes you smile?',
  'When did you first realize you were falling for me?',
  'What is a memory of us you replay in your head the most?',
  'What is one place you secretly hope we end up living someday?',
  'What is something you find adorable about me but never say out loud?',
  'If you could relive one ordinary day with me, which would it be?',
  'What is a little dream you have that you have not told me yet?',
  'What is the kindest thing I have ever done for you?',
  'What song instantly reminds you of us?',
  'What is one of my habits you have quietly grown to love?',
  'What did you think the very first time you saw me?',
  'What is a tradition you would love for us to start together?',
  'When do you feel the most loved by me?',
  'What is something new you would love for us to learn together?',
  'What is the happiest you have ever felt with me?',
  'What part of our future are you most excited about?',
  'What is a small way I could make your ordinary days better?',
  'What is your favorite photo of us and why?',
  'What is something brave you did because of how you feel about me?',
  'If you had to describe our love in one word, what would it be?',
  'What is a fear you have shared only with me?',
  'What is the silliest argument we ever had that you laugh about now?',
  'What is a moment when you felt completely understood by me?',
  'What is one thing about us you hope never changes?',
];

/** Original cute, safe, in-the-moment couple dares. */
const DARES: readonly string[] = [
  'Send your partner a voice note saying three things you love about them.',
  'Give your partner your most heartfelt compliment with a straight face.',
  'Do your best impression of your partner for fifteen seconds.',
  'Slow-dance with your partner for one whole song, no music allowed.',
  'Share the very last photo in your camera roll and explain it.',
  'Make up a short rhyming poem about your partner on the spot.',
  'Look into your partner’s eyes for thirty seconds without laughing.',
  'Recreate the face you made on your first date together.',
  'Give your partner a five-second shoulder massage right now.',
  'Tell your partner a secret you have never told them before.',
  'Sing the chorus of “your song” out loud, however off-key.',
  'Plan an imaginary dream date for the two of you in one breath.',
  'Send a sweet good-morning text you would send tomorrow — right now.',
  'Do your happiest little victory dance for your partner.',
  'Whisper your favorite nickname for your partner three times.',
  'Draw a tiny heart somewhere your partner can see it later.',
  'Give your partner a genuine ten-second hug.',
  'Reenact how the two of you first met, narrating as you go.',
  'List five things you are grateful for about your partner, fast.',
  'Make your partner laugh within ten seconds, any way you can.',
  'Describe your partner using only animal comparisons.',
  'Strike a dramatic pose and freeze until your partner laughs.',
  'Tell your partner about a future memory you cannot wait to make.',
  'Give your partner a forehead kiss or blow them one from afar.',
];

type Choice = 'truth' | 'dare';

interface State {
  /** Whose turn it is to pick. */
  turn: 'a' | 'b';
  /** The active player's pick this round, or null before they choose. */
  choice: Choice | null;
  /** Index into TRUTHS/DARES once the host reveals a prompt. */
  promptIndex: number | null;
  /** Rounds completed (Done counts; Skip does not). */
  completed: number;
}

function initialState(): State {
  return { turn: 'a', choice: null, promptIndex: null, completed: 0 };
}

const randIndex = (len: number) => Math.floor(Math.random() * len);

export function TruthOrDare() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  /** Active player chose Truth or Dare → host picks a random prompt of that type. */
  const applyChoice = useCallback((player: 'a' | 'b', choice: Choice) => {
    const s = stateRef.current;
    if (s.turn !== player || s.choice !== null) return;
    const len = choice === 'truth' ? TRUTHS.length : DARES.length;
    const next: State = { ...s, choice, promptIndex: randIndex(len) };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  /** Done or Skip → pass the turn to the partner; Done counts toward completed. */
  const finish = useCallback((player: 'a' | 'b', done: boolean) => {
    const s = stateRef.current;
    if (s.turn !== player || s.choice === null) return;
    const next: State = {
      turn: player === 'a' ? 'b' : 'a',
      choice: null,
      promptIndex: null,
      completed: done ? s.completed + 1 : s.completed,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?:
          | { kind: 'choice'; choice: Choice }
          | { kind: 'finish'; done: boolean };
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
        if (msg.action.kind === 'choice') applyChoice('b', msg.action.choice);
        else if (msg.action.kind === 'finish') finish('b', msg.action.done);
      }
    },
    [applyChoice, finish],
  );

  const { role, partnerHere, send } = useGameSession('truth-or-dare', handleMessage);
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

  const myTurn = state.turn === role;

  const pick = (choice: Choice) => {
    if (!partnerHere || !myTurn || state.choice !== null) return;
    if (role === 'a') applyChoice('a', choice);
    else send({ type: 'action', action: { kind: 'choice', choice } });
  };

  const end = (done: boolean) => {
    if (!myTurn || state.choice === null) return;
    if (role === 'a') finish('a', done);
    else send({ type: 'action', action: { kind: 'finish', done } });
  };

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">🎯</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const prompt =
    state.choice !== null && state.promptIndex !== null
      ? (state.choice === 'truth' ? TRUTHS : DARES)[state.promptIndex]
      : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Turn banner + tally */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'rounded-full px-3 py-1 text-sm font-semibold transition-colors',
            myTurn
              ? 'bg-primary text-text-on-primary'
              : 'border border-border bg-surface text-text-muted',
          )}
        >
          {myTurn ? 'Your turn' : "Partner's turn"}
        </span>
        <span className="text-sm text-text-muted">
          Rounds: <span className="font-semibold text-text">{state.completed}</span>
        </span>
      </div>

      {/* Choosing phase */}
      {state.choice === null && (
        <Card cardStyle="elevated" className="flex flex-col items-center gap-5 text-center">
          <span className="text-4xl">🎯</span>
          {myTurn ? (
            <>
              <p className="text-sm text-text-muted">Truth or Dare?</p>
              <div className="flex w-full gap-3">
                <Button
                  variant="primary"
                  shape="pill"
                  className="flex-1"
                  onClick={() => pick('truth')}
                >
                  Truth
                </Button>
                <Button
                  variant="secondary"
                  shape="pill"
                  className="flex-1"
                  onClick={() => pick('dare')}
                >
                  Dare
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">
              Waiting for your partner to choose Truth or Dare…
            </p>
          )}
        </Card>
      )}

      {/* Reveal phase */}
      {state.choice !== null && prompt && (
        <div className="flex flex-col gap-4 duration-500 animate-in fade-in slide-in-from-bottom-2">
          <Card cardStyle="elevated" className="flex flex-col gap-4 text-center">
            <span
              className={cn(
                'mx-auto rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                state.choice === 'truth'
                  ? 'bg-primary text-text-on-primary'
                  : 'bg-secondary text-text-on-primary',
              )}
            >
              {state.choice}
            </span>
            <p className="text-lg font-medium leading-snug text-text">{prompt}</p>
            <p className="text-xs text-text-muted">
              {myTurn ? "It's your prompt 💫" : 'Your partner is up'}
            </p>
          </Card>

          {myTurn ? (
            <div className="flex justify-center gap-3">
              <Button variant="primary" shape="pill" onClick={() => end(true)}>
                Done ✓
              </Button>
              <Button variant="outline" shape="pill" onClick={() => end(false)}>
                Skip
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-text-muted">
              Cheer your partner on…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
