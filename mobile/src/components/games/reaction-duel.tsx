import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

const WIN_TARGET = 3; // best of 5
const MIN_DELAY = 1500;
const MAX_DELAY = 4000;

/** Monotonic-ish clock; falls back to Date.now when performance is unavailable. */
const now = (): number => {
  const p = (globalThis as { performance?: { now?: () => number } }).performance;
  return p && typeof p.now === 'function' ? p.now() : Date.now();
};

type Phase = 'idle' | 'ready' | 'go' | 'result';

interface RoundResult {
  ms: { a: number | null; b: number | null };
  early: { a: boolean; b: boolean };
  winner: 'a' | 'b';
}

interface State {
  round: number;
  scores: { a: number; b: number };
  phase: Phase;
  result: RoundResult | null;
  matchWinner: 'a' | 'b' | null;
  goNonce: number;
}

function initialState(): State {
  return { round: 1, scores: { a: 0, b: 0 }, phase: 'idle', result: null, matchWinner: null, goNonce: 0 };
}

export function ReactionDuel() {
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  const tapsRef = useRef<{ a: number | null | 'early'; b: number | null | 'early' }>({ a: null, b: null });
  const goTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goReceiptRef = useRef<number | null>(null);
  const tappedRef = useRef(false);

  const clearGoTimer = useCallback(() => {
    if (goTimerRef.current) {
      clearTimeout(goTimerRef.current);
      goTimerRef.current = null;
    }
  }, []);

  const resolveRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'ready' && s.phase !== 'go') return;
    if (s.matchWinner) return;
    const taps = tapsRef.current;

    const aEarly = taps.a === 'early';
    const bEarly = taps.b === 'early';
    const anyEarly = aEarly || bEarly;
    if (!anyEarly && (taps.a === null || taps.b === null)) return;

    const aMs = aEarly || taps.a === null ? null : (taps.a as number);
    const bMs = bEarly || taps.b === null ? null : (taps.b as number);

    let winner: 'a' | 'b';
    if (aEarly && bEarly) winner = s.goNonce % 2 === 0 ? 'a' : 'b';
    else if (aEarly) winner = 'b';
    else if (bEarly) winner = 'a';
    else winner = (aMs as number) <= (bMs as number) ? 'a' : 'b';

    clearGoTimer();

    const scores = { ...s.scores };
    scores[winner] += 1;
    const matchWinner = scores.a >= WIN_TARGET ? 'a' : scores.b >= WIN_TARGET ? 'b' : null;

    const next: State = {
      ...s,
      phase: 'result',
      scores,
      result: { ms: { a: aMs, b: bMs }, early: { a: aEarly, b: bEarly }, winner },
      matchWinner,
    };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, [clearGoTimer]);

  const applyTap = useCallback(
    (player: 'a' | 'b', payload: { elapsed?: number; early?: boolean }) => {
      const s = stateRef.current;
      if (s.matchWinner) return;
      if (s.phase !== 'ready' && s.phase !== 'go') return;
      if (payload.early) {
        if (s.phase !== 'ready') return;
      } else if (s.phase !== 'go') {
        return;
      }
      if (tapsRef.current[player] !== null) return;

      tapsRef.current[player] = payload.early
        ? 'early'
        : typeof payload.elapsed === 'number'
          ? Math.max(0, Math.round(payload.elapsed))
          : 'early';
      resolveRound();
    },
    [resolveRound],
  );

  const startRound = useCallback(() => {
    const s = stateRef.current;
    if (s.matchWinner) return;
    if (s.phase === 'ready' || s.phase === 'go') return;
    if (!partnerHereRef.current) return;

    clearGoTimer();
    tapsRef.current = { a: null, b: null };

    const ready: State = { ...s, phase: 'ready', result: null };
    setState(ready);
    sendRef.current({ type: 'sync', state: ready });

    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    goTimerRef.current = setTimeout(() => {
      const cur = stateRef.current;
      if (cur.phase !== 'ready' || cur.matchWinner) return;
      goReceiptRef.current = now();
      tappedRef.current = false;
      const live: State = { ...cur, phase: 'go', goNonce: cur.goNonce + 1 };
      setState(live);
      sendRef.current({ type: 'sync', state: live });
      sendRef.current({ type: 'go' });
    }, delay);
  }, [clearGoTimer]);

  const nextRound = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'result' || s.matchWinner) return;
    clearGoTimer();
    tapsRef.current = { a: null, b: null };
    const next: State = { ...s, round: s.round + 1, phase: 'idle', result: null };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, [clearGoTimer]);

  const handleMessage = useCallback(
    (data: unknown) => {
      const msg = data as {
        type?: string;
        state?: State;
        action?: { kind?: 'start' | 'next'; elapsed?: number; early?: boolean };
      };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'go') {
          goReceiptRef.current = now();
          tappedRef.current = false;
        } else if (msg.type === 'sync' && msg.state) {
          setState(msg.state);
        }
        return;
      }

      if (msg.type === 'hello') {
        sendRef.current({ type: 'sync', state: stateRef.current });
      } else if (msg.type === 'action' && msg.action) {
        if (msg.action.kind === 'start') startRound();
        else if (msg.action.kind === 'next') nextRound();
        else applyTap('b', { elapsed: msg.action.elapsed, early: msg.action.early });
      } else if (msg.type === 'reset') {
        clearGoTimer();
        tapsRef.current = { a: null, b: null };
        const next = initialState();
        setState(next);
        sendRef.current({ type: 'sync', state: next });
      }
    },
    [startRound, nextRound, applyTap, clearGoTimer],
  );

  const { role, partnerHere, send } = useGameSession('reaction-duel', handleMessage);
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

  useEffect(() => clearGoTimer, [clearGoTimer]);

  const onStart = useCallback(() => {
    const s = stateRef.current;
    if (!partnerHere || s.matchWinner) return;
    if (s.phase === 'ready' || s.phase === 'go') return;
    if (role === 'a') startRound();
    else send({ type: 'action', action: { kind: 'start' } });
  }, [partnerHere, role, startRound, send]);

  const onNext = useCallback(() => {
    if (role === 'a') nextRound();
    else send({ type: 'action', action: { kind: 'next' } });
  }, [role, nextRound, send]);

  const onPlayAgain = useCallback(() => {
    if (role === 'a') {
      clearGoTimer();
      tapsRef.current = { a: null, b: null };
      const next = initialState();
      setState(next);
      send({ type: 'sync', state: next });
    } else {
      send({ type: 'reset' });
    }
  }, [role, send, clearGoTimer]);

  const reportTap = useCallback(
    (payload: { elapsed?: number; early?: boolean }) => {
      if (role === 'a') applyTap('a', payload);
      else send({ type: 'action', action: payload });
    },
    [role, applyTap, send],
  );

  const onTap = useCallback(() => {
    const s = stateRef.current;
    if (s.matchWinner || s.phase === 'idle' || s.phase === 'result') return;
    if (tappedRef.current) return;
    tappedRef.current = true;

    if (s.phase === 'ready') {
      reportTap({ early: true });
      return;
    }
    const receipt = goReceiptRef.current;
    const elapsed = receipt === null ? 0 : Math.max(0, now() - receipt);
    reportTap({ elapsed });
  }, [reportTap]);

  const myScore = state.scores[role];
  const partnerScore = state.scores[role === 'a' ? 'b' : 'a'];
  const other = role === 'a' ? 'b' : 'a';

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 36 }}>
          <AppText style={{ fontSize: 44 }}>⚡</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const r = state.result;
  const myMs = r ? r.ms[role] : null;
  const partnerMs = r ? r.ms[other] : null;
  const myEarly = r ? r.early[role] : false;
  const partnerEarly = r ? r.early[other] : false;
  const roundOutcome: 'win' | 'lose' | null = r ? (r.winner === role ? 'win' : 'lose') : null;

  const isGo = state.phase === 'go';
  const isReady = state.phase === 'ready';
  const tappable = state.phase === 'go' || state.phase === 'ready';

  let arenaLabel: string;
  if (state.phase === 'idle') arenaLabel = 'Tap "Start round" when ready';
  else if (isReady) arenaLabel = 'Get ready…';
  else if (isGo) arenaLabel = 'GO!';
  else arenaLabel = roundOutcome === 'win' ? 'You win the round! 🎉' : 'Partner takes the round';

  const arenaBg = isGo
    ? colors.success
    : isReady
      ? colors.surfaceHover
      : colors.surface;
  const arenaBorder = isGo ? colors.success : isReady ? colors.secondary : colors.border;
  const arenaText = isGo ? colors.textOnPrimary : isReady ? colors.secondary : colors.textMuted;

  return (
    <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: 20 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} target={WIN_TARGET} highlight />
        <ScorePill label="Partner" value={partnerScore} target={WIN_TARGET} />
      </View>

      <AppText center variant="caption" muted>
        {`Round ${state.round} · First to ${WIN_TARGET} · Best of 5`}
      </AppText>

      <Pressable
        onPress={onTap}
        disabled={!tappable || !!state.matchWinner}
        style={{
          minHeight: 180,
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: arenaBorder,
          backgroundColor: arenaBg,
          paddingHorizontal: 16,
        }}
      >
        {state.phase === 'result' && r ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <AppText
              variant="title"
              style={{ color: roundOutcome === 'win' ? colors.success : colors.error }}
            >
              {arenaLabel}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 32 }}>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <AppText variant="caption" muted>You</AppText>
                <AppText
                  variant="label"
                  style={{ color: myEarly ? colors.error : colors.text }}
                >
                  {myEarly ? 'Too soon! 🫣' : `${myMs ?? '—'} ms`}
                </AppText>
              </View>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <AppText variant="caption" muted>Partner</AppText>
                <AppText
                  variant="label"
                  style={{ color: partnerEarly ? colors.error : colors.text }}
                >
                  {partnerEarly ? 'Too soon! 🫣' : `${partnerMs ?? '—'} ms`}
                </AppText>
              </View>
            </View>
          </View>
        ) : (
          <>
            {isGo && <AppText style={{ fontSize: 48 }}>⚡</AppText>}
            <AppText style={{ fontSize: isGo ? 38 : 20, fontWeight: '800', color: arenaText }}>
              {arenaLabel}
            </AppText>
            {isReady && (
              <AppText variant="caption" muted>Don&apos;t tap until it flashes GO</AppText>
            )}
          </>
        )}
      </Pressable>

      <View style={{ alignItems: 'center', gap: 12 }}>
        {state.matchWinner ? (
          <>
            <AppText
              variant="label"
              center
              style={{ color: state.matchWinner === role ? colors.success : colors.error }}
            >
              {state.matchWinner === role ? 'Match won! 🎉' : 'Partner won the match'}
            </AppText>
            <Button variant="primary" onPress={onPlayAgain} label="Play again" />
          </>
        ) : state.phase === 'result' ? (
          <Button variant="primary" onPress={onNext} label="Next round" />
        ) : state.phase === 'idle' ? (
          <Button variant="primary" onPress={onStart} label="Start round" />
        ) : (
          <AppText variant="label" muted center>
            {isGo ? 'Tap the panel — fast!' : 'Steady… wait for GO'}
          </AppText>
        )}
      </View>
    </View>
  );
}

function ScorePill({
  label,
  value,
  target,
  highlight,
}: {
  label: string;
  value: number;
  target: number;
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
      <AppText variant="title">
        {value}
        <AppText variant="caption" muted>{` / ${target}`}</AppText>
      </AppText>
    </View>
  );
}
