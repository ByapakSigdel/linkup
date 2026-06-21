import { useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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

interface State {
  seedIndex: number;
  round: number;
  target: { a: string; b: string };
  pending: { a: string | null; b: string | null };
  phase: Phase;
  reveal: { a: string; b: string; matched: boolean } | null;
  melds: number;
  streak: number;
  best: number | null;
  gaveUp: boolean;
}

function firstTarget(seed: string): { a: string; b: string } {
  return { a: seed, b: seed };
}

function initialState(): State {
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
 * the host strips the other player's pending word so a peeking client
 * can't learn it early.
 */
function publicView(s: State, viewer: 'a' | 'b'): State {
  if (s.phase === 'revealed') return s;
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
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});
  const seededRef = useRef(false);

  const [draft, setDraft] = useState('');
  const myWordRef = useRef<string | null>(null);

  const [flash, setFlash] = useState(false);
  const lastRevealRef = useRef<State['reveal']>(null);

  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

  const applyWord = useCallback(
    (player: 'a' | 'b', rawWord: string) => {
      const s = stateRef.current;
      if (s.phase === 'revealed') return;
      if (s.pending[player]) return;

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
      streak: s.streak,
      gaveUp: false,
    };
    setState(next);
    broadcast(next);
  }, [broadcast]);

  const continueRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'revealed' || !s.reveal) return;

    if (s.reveal.matched) {
      newSeed();
      return;
    }

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

  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  useEffect(() => {
    if (role === 'a' && !seededRef.current) {
      seededRef.current = true;
      newSeed();
    }
  }, [role, newSeed]);

  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      broadcast(stateRef.current);
    }
  }, [partnerHere, role, broadcast]);

  // Reset local draft/word whenever a new collecting round begins.
  useEffect(() => {
    if (state.phase === 'collecting') {
      const other = role === 'a' ? 'b' : 'a';
      if (!state.pending[role] && !state.pending[other]) {
        myWordRef.current = null;
        setDraft('');
      }
    }
  }, [state.phase, state.pending, state.round, state.seedIndex, role]);

  useEffect(() => {
    if (state.reveal && state.reveal !== lastRevealRef.current) {
      lastRevealRef.current = state.reveal;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
    if (!state.reveal) lastRevealRef.current = null;
  }, [state.reveal]);

  const serverMine = state.pending[role];
  const myWord: string | null =
    serverMine && serverMine !== '__hidden__' ? serverMine : myWordRef.current;
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
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>🧠</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const isSeedRound = state.round === 1;
  const r = state.reveal;
  const myReveal = r ? r[role] : null;
  const partnerReveal = r ? r[partnerKey] : null;

  return (
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 18 }}>
      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatPill label="Melds" value={String(state.melds)} icon="💞" />
        <StatPill label="Streak" value={String(state.streak)} icon="🔥" />
        <StatPill label="Best" value={state.best === null ? '—' : `${state.best}r`} icon="🎯" />
      </View>

      {/* Prompt */}
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
          <AppText variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            {isSeedRound ? 'Same word, no peeking' : `Bridge round ${state.round}`}
          </AppText>
          {isSeedRound ? (
            <>
              <AppText muted>First word that pops into your head:</AppText>
              <AppText style={{ fontSize: 30, fontWeight: '800', color: colors.primary }}>{state.target.a}</AppText>
            </>
          ) : (
            <>
              <AppText muted>Say a word that links</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <AppText variant="subtitle" weight="700" style={{ color: colors.primary }}>{state.target.a}</AppText>
                <AppText variant="subtitle" muted style={{ marginHorizontal: 8 }}>&amp;</AppText>
                <AppText variant="subtitle" weight="700" style={{ color: colors.accent }}>{state.target.b}</AppText>
              </View>
            </>
          )}
        </View>
      </Card>

      {/* Reveal or input */}
      {state.phase === 'revealed' && r ? (
        <Card variant="elevated" style={flash ? { transform: [{ scale: 1.02 }] } : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12, paddingVertical: 4 }}>
            <RevealWord who="You" word={myReveal ?? ''} matched={r.matched} />
            <View style={{ justifyContent: 'center' }}>
              <AppText variant="subtitle" weight="700" muted>{r.matched ? '=' : 'vs'}</AppText>
            </View>
            <RevealWord who="Partner" word={partnerReveal ?? ''} matched={r.matched} />
          </View>

          <AppText
            center
            variant="label"
            style={{ paddingTop: 8, color: r.matched ? colors.success : colors.textMuted }}
          >
            {r.matched
              ? `Mind meld! 💞 ${isSeedRound ? 'Instant sync.' : `Converged in ${state.round} rounds.`}`
              : state.round >= MAX_ROUNDS
                ? "Not quite — let's try a new one"
                : 'Different minds — try to bridge them next'}
          </AppText>
        </Card>
      ) : (
        <Card variant="elevated">
          <View style={{ gap: 12, paddingVertical: 2 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <StatusChip label="You" ready={submitted} />
              <StatusChip label="Partner" ready={partnerSubmitted} />
            </View>

            {submitted ? (
              <AppText center muted>
                Locked in <AppText style={{ color: colors.primary }}>“{myWord}”</AppText> · waiting for partner…
              </AppText>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  autoFocus
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={submit}
                  placeholder="Type one word…"
                  placeholderTextColor={colors.textMuted}
                  maxLength={40}
                  returnKeyType="send"
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: radius.input,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                    paddingHorizontal: 14,
                    color: colors.text,
                    fontSize: 15,
                  }}
                />
                <Button variant="primary" onPress={submit} disabled={!draft.trim()} label="Send" />
              </View>
            )}
          </View>
        </Card>
      )}

      {/* Controls */}
      {state.phase === 'revealed' && r && (
        <Animated.View entering={FadeInDown.duration(400)} style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          <Button
            variant="primary"
            onPress={onContinue}
            label={r.matched ? 'New word' : state.round >= MAX_ROUNDS ? 'Fresh start' : 'Keep bridging'}
          />
          {!r.matched && state.round < MAX_ROUNDS && (
            <Button variant="ghost" onPress={onNewSeed} label="New word" />
          )}
        </Animated.View>
      )}
    </View>
  );
}

function StatPill({ label, value, icon }: { label: string; value: string; icon: string }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 10,
      }}
    >
      <AppText variant="caption" muted>{icon} {label}</AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}

function StatusChip({ label, ready }: { label: string; ready: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: radius.card,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderColor: ready ? colors.success : colors.border,
        backgroundColor: ready ? colors.surfaceHover : colors.surface,
      }}
    >
      <AppText style={{ color: ready ? colors.success : colors.textMuted }}>{ready ? '✓' : '·'}</AppText>
      <AppText variant="label" style={{ color: ready ? colors.success : colors.textMuted }}>{label}</AppText>
    </View>
  );
}

function RevealWord({ who, word, matched }: { who: string; word: string; matched: boolean }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <View
        style={{
          minHeight: 64,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.card,
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 12,
          borderColor: matched ? colors.success : colors.border,
          backgroundColor: matched ? colors.surfaceHover : colors.surface,
        }}
      >
        <AppText center variant="subtitle" weight="700" style={{ color: matched ? colors.success : colors.text }}>
          {word}
        </AppText>
      </View>
      <AppText variant="caption" muted weight="600">{who}</AppText>
    </View>
  );
}
