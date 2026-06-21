import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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
  order: number[];
  step: number;
  subject: 'a' | 'b';
  picks: { a: number | null; b: number | null };
  phase: Phase;
  scores: { a: number; b: number };
  lastCorrect: boolean | null;
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
  const { colors, radius } = useTheme();
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

      const guesser: 'a' | 'b' = s.subject === 'a' ? 'b' : 'a';
      const correct = picks[guesser] === picks[s.subject];
      const scores = correct ? { ...s.scores, [guesser]: s.scores[guesser] + 1 } : s.scores;
      pushState({ ...s, picks, phase: 'reveal', scores, lastCorrect: correct });
    },
    [pushState],
  );

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

  useEffect(() => {
    if (role === 'a' && !seededRef.current) {
      seededRef.current = true;
      const seeded = freshState();
      setState(seeded);
      send({ type: 'sync', state: seeded });
    }
  }, [role, send]);

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

  if (!partnerHere) {
    return (
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>💞</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
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
    let verdictColor = colors.textMuted;
    if (mine > theirs) {
      verdict = 'You know them best! 🎉';
      verdictColor = colors.success;
    } else if (mine < theirs) {
      verdict = 'They read you like a book 💫';
      verdictColor = colors.error;
    } else {
      verdict = "You're perfectly in sync ✨";
      verdictColor = colors.textMuted;
    }
    return (
      <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ScorePill label={role === 'a' ? 'You' : 'Partner'} value={state.scores.a} highlight={role === 'a'} />
          <ScorePill label={role === 'b' ? 'You' : 'Partner'} value={state.scores.b} highlight={role === 'b'} />
        </View>
        <Card variant="elevated" style={{ alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 20 }}>
            <AppText style={{ fontSize: 44 }}>🏆</AppText>
            <AppText variant="subtitle" weight="700" style={{ color: verdictColor }}>{verdict}</AppText>
            <AppText variant="caption" muted center>
              You guessed {mine} of {Math.floor(total / 2) + (total % 2)} · they guessed {theirs}
            </AppText>
          </View>
        </Card>
        <View style={{ alignItems: 'center' }}>
          <Button variant="primary" onPress={onPlayAgain} label="Play again" />
        </View>
      </View>
    );
  }

  // ---- ROUND screen ----
  const subjectLabel = state.subject === role ? 'You' : 'Partner';

  let status: string;
  let statusColor = colors.text;
  if (state.phase === 'answering') {
    if (subjectIsMe) {
      status = iAnswered ? 'Waiting for their guess…' : 'Answer truthfully about you';
    } else {
      status = iAnswered ? 'Waiting for their answer…' : "Guess what they'd pick";
    }
    statusColor = iAnswered ? colors.textMuted : colors.success;
  } else {
    status = state.lastCorrect ? 'Matched! 🎉' : 'Not quite this time';
    statusColor = state.lastCorrect ? colors.success : colors.textMuted;
  }

  const reveal = state.phase === 'reveal';
  const truth = state.picks[state.subject];
  const guess = state.picks[guesser];

  return (
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 18 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label={role === 'a' ? 'You' : 'Partner'} value={state.scores.a} highlight={role === 'a'} />
        <ScorePill label={role === 'b' ? 'You' : 'Partner'} value={state.scores.b} highlight={role === 'b'} />
      </View>

      {/* Round meta */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="caption" muted>Question {state.step + 1} / {total}</AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <AppText variant="caption">🔎</AppText>
          <AppText variant="caption" weight="600">About {subjectLabel.toLowerCase()}</AppText>
        </View>
      </View>

      {/* Status */}
      <AppText center variant="label" style={{ color: statusColor }}>{status}</AppText>

      {/* Question */}
      <Card variant="elevated">
        <AppText center variant="subtitle" weight="700">{question.prompt}</AppText>
      </Card>

      {/* Options */}
      <View style={{ gap: 10 }}>
        {question.options.map((opt, i) => {
          const chosenByMe = myPick === i;
          const isTruth = reveal && truth === i;
          const isGuess = reveal && guess === i;
          const matched = reveal && truth === i && guess === i;
          const selectable = state.phase === 'answering' && !iAnswered;
          const borderColor = matched
            ? colors.success
            : !matched && isTruth
              ? colors.success
              : !matched && isGuess
                ? colors.borderFocus
                : !reveal && chosenByMe
                  ? colors.primary
                  : colors.border;
          const filled = matched || isTruth || isGuess || (!reveal && chosenByMe);
          return (
            <Pressable
              key={i}
              onPress={() => submitPick(i)}
              disabled={!selectable}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor,
                backgroundColor: filled || (pressed && selectable) ? colors.surfaceHover : colors.surface,
                paddingHorizontal: 16,
                paddingVertical: 12,
              })}
            >
              <AppText style={{ flex: 1, fontWeight: '600', color: matched ? colors.success : colors.text }}>{opt}</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!reveal && chosenByMe && <AppText>✅</AppText>}
                {reveal && isTruth && (
                  <AppText variant="caption" weight="700" style={{ color: colors.success, textTransform: 'uppercase' }}>Truth</AppText>
                )}
                {reveal && isGuess && !matched && (
                  <AppText variant="caption" weight="700" muted style={{ textTransform: 'uppercase' }}>Guess</AppText>
                )}
                {matched && (
                  <AppText variant="caption" weight="700" style={{ color: colors.success, textTransform: 'uppercase' }}>Match</AppText>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Reveal caption + controls */}
      {reveal && (
        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 14, alignItems: 'center' }}>
          <AppText variant="caption" muted center>
            {guesser === role
              ? state.lastCorrect
                ? 'You guessed it right — +1 for you!'
                : 'Your guess and their truth differed.'
              : state.lastCorrect
                ? 'They read you perfectly — +1 for them!'
                : 'They guessed differently this round.'}
          </AppText>
          <Button
            variant="primary"
            onPress={onNext}
            label={state.step + 1 >= total ? 'See results' : 'Next question'}
          />
        </Animated.View>
      )}
    </View>
  );
}

function ScorePill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
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
      <AppText variant="caption" muted center>{label} · correct guesses</AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}
