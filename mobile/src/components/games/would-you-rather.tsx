import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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
  order: number[];
  pos: number;
  picks: { a: 0 | 1 | null; b: 0 | 1 | null };
  revealed: boolean;
  matches: number;
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
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

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
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>🤔</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const promptPair = PROMPTS[state.order[state.pos] ?? 0] ?? PROMPTS[0]!;
  const optA = promptPair[0];
  const optB = promptPair[1];
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
  let statusColor = colors.text;
  if (state.revealed) {
    if (matched) {
      status = 'You matched! 💞';
      statusColor = colors.success;
    } else {
      status = 'Different picks — opposites attract 😄';
      statusColor = colors.text;
    }
  } else if (myPick === null) {
    status = 'Pick one — privately';
    statusColor = colors.text;
  } else {
    status = 'Locked in! Waiting for your partner…';
    statusColor = colors.textMuted;
  }

  return (
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
      {/* Tally */}
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 14,
            paddingVertical: 6,
          }}
        >
          <AppText variant="label">Matches: </AppText>
          <AppText variant="label" color={colors.success}>{state.matches}</AppText>
          <AppText variant="label" muted> / {state.played}</AppText>
        </View>
      </View>

      {/* Prompt header */}
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <AppText
          variant="caption"
          muted
          style={{ textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' }}
        >
          Would you rather…
        </AppText>
      </Card>

      {/* Options */}
      <View style={{ gap: 12 }}>
        {options.map((opt) => {
          const isMine = myChoice === opt.idx;
          const isPartners = state.revealed && partnerChoice === opt.idx;
          const chosen = isMine || isPartners;
          const playable = !state.revealed && myPick === null;
          const borderColor = state.revealed
            ? matched && chosen
              ? colors.success
              : chosen
                ? colors.primary
                : colors.border
            : isMine
              ? colors.primary
              : colors.border;
          const badgeBg =
            chosen && matched && state.revealed
              ? colors.success
              : colors.primary;
          return (
            <Pressable
              key={opt.idx}
              onPress={() => choose(opt.idx)}
              disabled={!playable}
              style={({ pressed }) => ({
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor,
                backgroundColor:
                  chosen || (pressed && playable) ? colors.surfaceHover : colors.surface,
                padding: 16,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: chosen ? badgeBg : colors.border,
                    backgroundColor: chosen ? badgeBg : 'transparent',
                  }}
                >
                  <AppText
                    weight="800"
                    style={{ color: chosen ? colors.textOnPrimary : colors.textMuted }}
                  >
                    {opt.idx === 0 ? 'A' : 'B'}
                  </AppText>
                </View>
                <AppText style={{ flex: 1, fontWeight: '600' }}>{opt.text}</AppText>
              </View>

              {state.revealed && (isMine || isPartners) && (
                <Animated.View
                  entering={FadeIn.duration(300)}
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingLeft: 40 }}
                >
                  {isMine && (
                    <View style={{ borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <AppText variant="caption" weight="700" style={{ color: colors.textOnPrimary }}>You</AppText>
                    </View>
                  )}
                  {isPartners && (
                    <View
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        backgroundColor: matched ? colors.success : colors.surfaceHover,
                        borderWidth: matched ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    >
                      <AppText variant="caption" weight="700" style={{ color: matched ? colors.textOnPrimary : colors.text }}>Partner</AppText>
                    </View>
                  )}
                </Animated.View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>{status}</AppText>

      {/* Reveal flourish + next */}
      {state.revealed && (
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', gap: 12 }}>
          {matched && <AppText style={{ fontSize: 30 }}>🎉</AppText>}
          <Button variant="primary" onPress={onNext} label="Next prompt" />
        </Animated.View>
      )}
    </View>
  );
}
