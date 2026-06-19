'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { Button, Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Original seed words — wholesome, evocative, easy to free-associate from. */
const SEEDS: readonly string[] = [
  'moonlight',
  'pancakes',
  'thunder',
  'velvet',
  'campfire',
  'lantern',
  'cinnamon',
  'tide',
  'meadow',
  'compass',
  'snowflake',
  'harbor',
  'whisper',
  'orchard',
  'firefly',
  'driftwood',
  'umbrella',
  'maple',
  'galaxy',
  'cobblestone',
  'mittens',
  'seashell',
  'bonfire',
  'puddle',
  'starlight',
  'cocoa',
  'meteor',
  'willow',
  'breeze',
  'cottage',
];

/** Max bridging rounds before we gently reset to a fresh seed. */
const MAX_ROUNDS = 6;

type Phase = 'collecting' | 'revealed';

/** Authoritative state owned by the HOST (role 'a'). */
interface State {
  /** Index into SEEDS for the very first prompt of this attempt. */
  seedIndex: number;
  /** Round number within the current attempt (1 = the seed round). */
  round: number;
  /**
   * The two words to bridge this round. On round 1 both are the seed
   * (we just show the seed). After a mismatch these become the two
   * previously-submitted words.
   */
  target: { a: string; b: string };
  /** Secret submissions for the current round; revealed only when both are in. */
  pending: { a: string | null; b: string | null };
  /** Phase of the current round. */
  phase: Phase;
  /** When revealed, the two words + whether they matched. */
  reveal: { a: string; b: string; matched: boolean } | null;
  /** Running stats for the pair. */
  melds: number;
  /** Current streak of consecutive instant (round-1) melds. */
  streak: number;
  /** Best convergence: fewest rounds taken to reach a meld (lower is better). */
  best: number | null;
  /** Set true on the round where we exhausted MAX_ROUNDS without converging. */
  gaveUp: boolean;
}

function firstTarget(seed: string): { a: string; b: string } {
  return { a: seed, b: seed };
}

function initialState(): State {
  // SSR-safe: deterministic placeholder. The HOST seeds real randomness
  // in an effect after mount and broadcasts it.
  const seed = SEEDS[0] ?? 'moonlight';
  return {
    seedIndex: 0,
    round: 1,
    target: firstTarget(seed),
    pending: { a: null, b: null },
    phase: 'collecting',
    reveal: null,
    melds: 0,
    streak: 0,
    best: null,
    gaveUp: false,
  };
}

/** Normalize a word for matching: trim, lowercase, collapse spaces, drop trivial plural. */
function normalize(word: string): string {
  let w = word.trim().toLowerCase().replace(/\s+/g, ' ');
  // Strip a trailing simple plural so "stars" matches "star", "boxes" matches "box".
  if (w.length > 3) {
    if (w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
    else if (w.endsWith('es')) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  }
  return w;
}

function wordsMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * What a given viewer is allowed to see. Until both submissions are in,
 * the host strips the *other* player's pending word so a peeking client
 * can't learn it early. Each side keeps its own pending word locally.
 */
function publicView(s: State, viewer: 'a' | 'b'): State {
  if (s.phase === 'revealed') return s; // safe to show everything
  const other = viewer === 'a' ? 'b' : 'a';
  return {
    ...s,
    pending: {
      ...s.pending,
      [other]: s.pending[other] ? '__hidden__' : null,
    },
  };
}

export function MindMeld() {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});
  const seededRef = useRef(false);

  // What I typed locally this round (so the guest can show its own pending
  // word even though the host masks the other side).
  const [draft, setDraft] = useState('');
  const myWordRef = useRef<string | null>(null);

  // Brief celebratory flash when a fresh reveal arrives.
  const [flash, setFlash] = useState(false);
  const lastRevealRef = useRef<State['reveal']>(null);

  /** HOST helper: broadcast the guest-filtered view. */
  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

  /** HOST: record a player's secret word and resolve the round if both are in. */
  const applyWord = useCallback(
    (player: 'a' | 'b', rawWord: string) => {
      const s = stateRef.current;
      if (s.phase === 'revealed') return; // already resolved
      if (s.pending[player]) return; // already submitted this round

      const word = rawWord.trim();
      if (!word) return;

      const pending = { ...s.pending, [player]: word };

      let next: State;
      if (pending.a && pending.b) {
        const a = pending.a;
        const b = pending.b;
        const matched = wordsMatch(a, b);

        let melds = s.melds;
        let streak = s.streak;
        let best = s.best;
        if (matched) {
          melds += 1;
          // round 1 melds extend the "instant sync" streak; later melds reset it
          streak = s.round === 1 ? s.streak + 1 : 0;
          if (best === null || s.round < best) best = s.round;
        }

        next = {
          ...s,
          pending,
          phase: 'revealed',
          reveal: { a, b, matched },
        };
        next.melds = melds;
        next.streak = streak;
        next.best = best;
      } else {
        next = { ...s, pending };
      }

      setState(next);
      broadcast(next);
    },
    [broadcast],
  );

  /** HOST: pick a fresh seed and start a brand-new attempt. */
  const newSeed = useCallback(() => {
    const s = stateRef.current;
    let idx = Math.floor(Math.random() * SEEDS.length);
    if (idx === s.seedIndex && SEEDS.length > 1) {
      idx = (idx + 1) % SEEDS.length;
    }
    const seed = SEEDS[idx] ?? SEEDS[0] ?? 'moonlight';
    const next: State = {
      ...s,
      seedIndex: idx,
      round: 1,
      target: firstTarget(seed),
      pending: { a: null, b: null },
      phase: 'collecting',
      reveal: null,
      streak: s.streak, // streak persists across fresh seeds (resets only on a non-instant meld)
      gaveUp: false,
    };
    setState(next);
    broadcast(next);
  }, [broadcast]);

  /** HOST: after a mismatch reveal, advance to the bridging round (or give up). */
  const continueRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'revealed' || !s.reveal) return;

    // A successful meld -> the only forward action is a fresh seed.
    if (s.reveal.matched) {
      newSeed();
      return;
    }

    // Mismatch: if we've hit the cap, gently reset to a new seed.
    if (s.round >= MAX_ROUNDS) {
      const idx = (s.seedIndex + 1) % SEEDS.length;
      const seed = SEEDS[idx] ?? SEEDS[0] ?? 'moonlight';
      const next: State = {
        ...s,
        seedIndex: idx,
        round: 1,
        target: firstTarget(seed),
        pending: { a: null, b: null },
        phase: 'collecting',
        reveal: null,
        streak: 0,
        gaveUp: false,
      };
      setState(next);
      broadcast(next);
      return;
    }

    // Otherwise bridge: the two mismatched words become the new target.
    const next: State = {
      ...s,
      round: s.round + 1,
      target: { a: s.reveal.a, b: s.reveal.b },
      pending: { a: null, b: null },
      phase: 'collecting',
      reveal: null,
    };
    setState(next);
    broadcast(next);
  }, [broadcast, newSeed]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind?: 'submit' | 'continue' | 'newSeed'; word?: string };
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
        if (msg.action.kind === 'submit' && msg.action.word) {
          applyWord('b', msg.action.word);
        } else if (msg.action.kind === 'continue') {
          continueRound();
        } else if (msg.action.kind === 'newSeed') {
          newSeed();
        }
      } else if (msg.type === 'reset') {
        const next = initialState();
        // keep tally/streak across a manual rematch
        const s = stateRef.current;
        next.melds = s.melds;
        next.best = s.best;
        next.streak = s.streak;
        setState(next);
        broadcast(next);
      }
    },
    [applyWord, continueRound, newSeed, broadcast],
  );

  const { role, partnerHere, send } = useGameSession('mind-meld', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  // Guest announces itself so the host sends current state.
  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  // HOST seeds real randomness exactly once after mount (SSR-safe).
  useEffect(() => {
    if (role === 'a' && !seededRef.current) {
      seededRef.current = true;
      newSeed();
    }
  }, [role, newSeed]);

  // Host re-broadcasts whenever the partner (re)joins.
  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      broadcast(stateRef.current);
    }
  }, [partnerHere, role, broadcast]);

  // Reset my local draft/word whenever a new collecting round begins.
  useEffect(() => {
    if (state.phase === 'collecting') {
      const other = role === 'a' ? 'b' : 'a';
      // A brand-new round clears both pendings; that's our cue to reset.
      if (!state.pending[role] && !state.pending[other]) {
        myWordRef.current = null;
        setDraft('');
      }
    }
  }, [state.phase, state.pending, state.round, state.seedIndex, role]);

  // Flash whenever a new reveal lands.
  useEffect(() => {
    if (state.reveal && state.reveal !== lastRevealRef.current) {
      lastRevealRef.current = state.reveal;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
    if (!state.reveal) lastRevealRef.current = null;
  }, [state.reveal]);

  // My own pending word: prefer what the server reports, fall back to local memory.
  const serverMine = state.pending[role];
  const myWord: string | null =
    serverMine && serverMine !== '__hidden__'
      ? serverMine
      : myWordRef.current;
  const submitted = !!myWord;

  const partnerKey = role === 'a' ? 'b' : 'a';
  const partnerPending = state.pending[partnerKey];
  const partnerSubmitted = state.phase === 'revealed' || !!partnerPending;

  const submit = () => {
    if (!partnerHere || state.phase === 'revealed' || submitted) return;
    const word = draft.trim();
    if (!word) return;
    myWordRef.current = word;
    if (role === 'a') applyWord('a', word);
    else send({ type: 'action', action: { kind: 'submit', word } });
  };

  const onContinue = () => {
    if (role === 'a') continueRound();
    else send({ type: 'action', action: { kind: 'continue' } });
  };

  const onNewSeed = () => {
    if (role === 'a') newSeed();
    else send({ type: 'action', action: { kind: 'newSeed' } });
  };

  if (!partnerHere) {
    return (
      <Card cardStyle="elevated" className="mx-auto max-w-md text-center">
        <div className="flex flex-col items-center gap-3 py-10">
          <Emoji emoji="🧠" size={44} />
          <p className="text-text-muted">Waiting for your partner to join…</p>
        </div>
      </Card>
    );
  }

  const isSeedRound = state.round === 1;
  const r = state.reveal;
  const myReveal = r ? r[role] : null;
  const partnerReveal = r ? r[partnerKey] : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="Melds" value={String(state.melds)} icon="💞" />
        <StatPill label="Streak" value={String(state.streak)} icon="🔥" />
        <StatPill
          label="Best"
          value={state.best === null ? '—' : `${state.best}r`}
          icon="🎯"
        />
      </div>

      {/* Prompt */}
      <Card cardStyle="elevated" className="text-center">
        <div className="flex flex-col items-center gap-2 py-2">
          <span className="text-xs uppercase tracking-wide text-text-muted">
            {isSeedRound ? 'Same word, no peeking' : `Bridge round ${state.round}`}
          </span>
          {isSeedRound ? (
            <>
              <p className="text-sm text-text-muted">
                First word that pops into your head:
              </p>
              <p className="text-3xl font-bold text-primary">
                {state.target.a}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-text-muted">Say a word that links</p>
              <p className="text-lg font-semibold text-text">
                <span className="text-primary">{state.target.a}</span>
                <span className="mx-2 text-text-muted">&amp;</span>
                <span className="text-accent">{state.target.b}</span>
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Reveal or input */}
      {state.phase === 'revealed' && r ? (
        <Card
          cardStyle="elevated"
          className={cn('transition-transform', flash && 'scale-[1.02]')}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3 py-2">
            <RevealWord
              who="You"
              word={myReveal ?? ''}
              matched={r.matched}
            />
            <span className="flex select-none items-center text-lg font-semibold text-text-muted">
              {r.matched ? '=' : 'vs'}
            </span>
            <RevealWord
              who="Partner"
              word={partnerReveal ?? ''}
              matched={r.matched}
            />
          </div>

          <p
            className={cn(
              'pt-2 text-center text-sm font-medium transition-colors',
              r.matched ? 'text-success' : 'text-text-muted',
            )}
          >
            {r.matched ? (
              <>
                Mind meld! <Emoji emoji="💞" size={16} />{' '}
                {isSeedRound ? 'Instant sync.' : `Converged in ${state.round} rounds.`}
              </>
            ) : state.round >= MAX_ROUNDS ? (
              "Not quite — let's try a new one"
            ) : (
              'Different minds — try to bridge them next'
            )}
          </p>
        </Card>
      ) : (
        <Card cardStyle="elevated">
          <div className="flex flex-col gap-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <StatusChip label="You" ready={submitted} />
              <StatusChip label="Partner" ready={partnerSubmitted} />
            </div>

            {submitted ? (
              <p className="text-center text-sm text-text-muted">
                Locked in <span className="text-primary">“{myWord}”</span> · waiting
                for partner…
              </p>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type one word…"
                  maxLength={40}
                  aria-label="Your word"
                  className={cn(
                    'h-11 flex-1 rounded-xl border border-border bg-surface px-3.5 text-text',
                    'placeholder:text-text-muted transition-all',
                    'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                  )}
                />
                <Button
                  type="submit"
                  variant="primary"
                  shape="pill"
                  disabled={!draft.trim()}
                >
                  Send
                </Button>
              </form>
            )}
          </div>
        </Card>
      )}

      {/* Controls */}
      {state.phase === 'revealed' && r && (
        <div className="flex justify-center gap-3">
          <Button variant="primary" shape="pill" onClick={onContinue}>
            {r.matched
              ? 'New word'
              : state.round >= MAX_ROUNDS
                ? 'Fresh start'
                : 'Keep bridging'}
          </Button>
          {!r.matched && state.round < MAX_ROUNDS && (
            <Button variant="ghost" shape="pill" onClick={onNewSeed}>
              New word
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-surface px-2 py-2.5 text-center">
      <span className="text-xs text-text-muted">
        <Emoji emoji={icon} size={13} /> {label}
      </span>
      <span className="text-xl font-bold text-text">{value}</span>
    </div>
  );
}

function StatusChip({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
        ready
          ? 'border-success bg-surface-hover text-success'
          : 'border-border bg-surface text-text-muted',
      )}
    >
      <span>{ready ? '✓' : '·'}</span>
      {label}
    </div>
  );
}

function RevealWord({
  who,
  word,
  matched,
}: {
  who: string;
  word: string;
  matched: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex min-h-16 w-full items-center justify-center rounded-2xl border px-2 py-3 text-center transition-all duration-300',
          matched
            ? 'border-success bg-surface-hover'
            : 'border-border bg-surface',
        )}
      >
        <span
          className={cn(
            'break-words text-lg font-semibold',
            matched ? 'text-success' : 'text-text',
          )}
        >
          {word}
        </span>
      </div>
      <span className="text-xs font-medium text-text-muted">{who}</span>
    </div>
  );
}
