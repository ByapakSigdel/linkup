'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Original "Would you rather" prompts about couple life. Each has option A & B. */
const PROMPTS: ReadonlyArray<readonly [string, string]> = [
  ['Travel the world together with one tiny backpack each', 'Build one dreamy home you never want to leave'],
  ['Have a standing pancake breakfast date every Sunday', 'Have a midnight pizza-and-movie ritual every Friday'],
  ['Always know exactly what the other is thinking', 'Always be surprised by each other forever'],
  ['Slow-dance in the kitchen with no music', 'Sing terribly in the car at full volume'],
  ['Get matching cozy pajamas you wear all winter', 'Get matching little tattoos only you two understand'],
  ['Adopt three goofy dogs together', 'Adopt two sleepy cats together'],
  ['Re-live your very first date once more', 'Fast-forward to a perfect lazy morning ten years from now'],
  ['Plan every trip down to the minute together', 'Show up at the airport and pick a flight on a whim'],
  ['Write each other a love letter every month', 'Send each other one silly voice note every day'],
  ['Cook a fancy meal together and make a mess', 'Order in and build a giant blanket fort'],
  ['Stargaze on a rooftop until you both fall asleep', 'Watch the sunrise after staying up all night talking'],
  ['Have a secret handshake only the two of you know', 'Have a secret nickname only the two of you use'],
  ['Take a pottery class together and laugh through it', 'Take a dance class together and step on toes'],
  ['Spend a rainy day reading side by side', 'Spend a snowy day having a window-side hot-chocolate war'],
  ['Always be the one who plans the surprises', 'Always be the one who gets happily surprised'],
  ['Grow a little garden together on the balcony', 'Build a tiny bookshelf together for your favorites'],
  ['Have your song play everywhere you go', 'Have a special photo from every place you visit'],
  ['Road-trip with a playlist you made together', 'Train ride watching the world roll by, heads on shoulders'],
  ['Be the couple who finishes each other’s sentences', 'Be the couple who tells the same story two different ways'],
  ['Spend an anniversary recreating your favorite memory', 'Spend an anniversary making a brand-new one somewhere unknown'],
  ['Have a cozy night-in for every celebration', 'Throw a tiny party for every little win'],
  ['Learn to bake bread together (and burn a few)', 'Learn to brew the perfect coffee together (one cup at a time)'],
  ['Keep a shared journal of everyday tiny joys', 'Keep a jar of folded notes to read on hard days'],
  ['Always wake up before your partner to make their coffee', 'Always be the one woken up gently with breakfast'],
];

interface State {
  /** Host-decided shuffled order over PROMPTS indices. */
  order: number[];
  /** Position within `order`. */
  pos: number;
  /** Each side's choice for the current prompt: 0 = A, 1 = B, null = undecided. */
  picks: { a: 0 | 1 | null; b: 0 | 1 | null };
  /** Whether both have answered and the round is revealed. */
  revealed: boolean;
  /** Running tally of how many prompts both matched on. */
  matches: number;
  /** How many prompts have been fully revealed (for the tally denominator). */
  played: number;
}

function shuffled(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function initialState(): State {
  return {
    order: shuffled(PROMPTS.length),
    pos: 0,
    picks: { a: null, b: null },
    revealed: false,
    matches: 0,
    played: 0,
  };
}

export function WouldYouRather() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  /** Apply a player's pick to host state, reveal + tally when both have answered. */
  const applyPick = useCallback((player: 'a' | 'b', choice: 0 | 1) => {
    const s = stateRef.current;
    if (s.revealed || s.picks[player] !== null) return;

    const picks = { ...s.picks, [player]: choice };
    const bothIn = picks.a !== null && picks.b !== null;
    const matched = bothIn && picks.a === picks.b;

    const next: State = {
      ...s,
      picks,
      revealed: bothIn,
      matches: bothIn && matched ? s.matches + 1 : s.matches,
      played: bothIn ? s.played + 1 : s.played,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  /** Host advances to the next prompt (reshuffles + replays when deck is done). */
  const advance = useCallback(() => {
    const s = stateRef.current;
    const nextPos = s.pos + 1;
    const wrapped = nextPos >= s.order.length;
    const next: State = {
      ...s,
      order: wrapped ? shuffled(PROMPTS.length) : s.order,
      pos: wrapped ? 0 : nextPos,
      picks: { a: null, b: null },
      revealed: false,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind: 'pick'; choice: 0 | 1 } | { kind: 'next' };
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
        if (msg.action.kind === 'pick') applyPick('b', msg.action.choice);
        else if (msg.action.kind === 'next') advance();
      }
    },
    [applyPick, advance],
  );

  const { role, partnerHere, send } = useGameSession('would-you-rather', handleMessage);
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

  const choose = (choice: 0 | 1) => {
    if (!partnerHere || state.revealed || state.picks[role] !== null) return;
    if (role === 'a') applyPick('a', choice);
    else send({ type: 'action', action: { kind: 'pick', choice } });
  };

  const onNext = () => {
    if (role === 'a') advance();
    else send({ type: 'action', action: { kind: 'next' } });
  };

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <span className="text-4xl">🤔</span>
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const [optA, optB] = PROMPTS[state.order[state.pos] ?? 0] ?? PROMPTS[0]!;
  const myPick = state.picks[role];
  const partnerRole: 'a' | 'b' = role === 'a' ? 'b' : 'a';
  const myChoice = state.picks[role];
  const partnerChoice = state.picks[partnerRole];
  const matched = state.revealed && myChoice === partnerChoice;
  const options: ReadonlyArray<{ idx: 0 | 1; text: string }> = [
    { idx: 0, text: optA },
    { idx: 1, text: optB },
  ];

  let status: string;
  let tone: 'normal' | 'success' | 'muted' = 'normal';
  if (state.revealed) {
    if (matched) {
      status = 'You matched! 💞';
      tone = 'success';
    } else {
      status = 'Different picks — opposites attract 😄';
      tone = 'normal';
    }
  } else if (myPick === null) {
    status = 'Pick one — privately';
    tone = 'normal';
  } else {
    status = 'Locked in! Waiting for your partner…';
    tone = 'muted';
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Tally */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="rounded-full border border-border bg-surface px-3 py-1 font-medium text-text">
          Matches: <span className="text-success">{state.matches}</span>
          <span className="text-text-muted"> / {state.played}</span>
        </span>
      </div>

      {/* Prompt */}
      <Card cardStyle="elevated" className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          Would you rather…
        </p>
      </Card>

      {/* Options */}
      <div className="flex flex-col gap-3">
        {options.map((opt) => {
          const isMine = myChoice === opt.idx;
          const isPartners = state.revealed && partnerChoice === opt.idx;
          const chosen = isMine || isPartners;
          const playable = !state.revealed && myPick === null;
          return (
            <button
              key={opt.idx}
              onClick={() => choose(opt.idx)}
              disabled={!playable}
              className={cn(
                'group relative w-full rounded-2xl border p-4 text-left transition-all',
                'border-border bg-surface',
                playable && 'cursor-pointer hover:border-primary hover:bg-surface-hover',
                !playable && 'cursor-default',
                isMine && !state.revealed && 'border-primary bg-surface-hover',
                state.revealed && matched && chosen && 'border-success bg-surface-hover',
                state.revealed && !matched && chosen && 'border-primary bg-surface-hover',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors',
                    chosen
                      ? matched && state.revealed
                        ? 'border-success bg-success text-text-on-primary'
                        : 'border-primary bg-primary text-text-on-primary'
                      : 'border-border text-text-muted',
                  )}
                >
                  {opt.idx === 0 ? 'A' : 'B'}
                </span>
                <span className="text-sm font-medium text-text">{opt.text}</span>
              </div>

              {/* Reveal badges */}
              {state.revealed && (isMine || isPartners) && (
                <div className="mt-3 flex flex-wrap gap-1.5 pl-10 duration-300 animate-in fade-in">
                  {isMine && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-text-on-primary">
                      You
                    </span>
                  )}
                  {isPartners && (
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        matched
                          ? 'bg-success text-text-on-primary'
                          : 'border border-border bg-surface-hover text-text',
                      )}
                    >
                      Partner
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Status */}
      <p
        className={cn(
          'text-center text-sm font-medium transition-colors',
          tone === 'success' && 'text-success',
          tone === 'muted' && 'text-text-muted',
          tone === 'normal' && 'text-text',
        )}
      >
        {status}
      </p>

      {/* Reveal flourish + next */}
      {state.revealed && (
        <div className="flex flex-col items-center gap-3 duration-500 animate-in fade-in slide-in-from-bottom-2">
          {matched && <span className="text-3xl">🎉</span>}
          <Button variant="primary" shape="pill" onClick={onNext}>
            Next prompt
          </Button>
        </div>
      )}
    </div>
  );
}
