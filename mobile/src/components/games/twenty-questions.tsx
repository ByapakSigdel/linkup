import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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
  question: string;
  answer: Answer | null;
}

type Phase = 'setup' | 'asking' | 'answering' | 'judging' | 'ended';

interface State {
  thinker: 'a' | 'b';
  secret: string;
  phase: Phase;
  log: QA[];
  pending: string | null;
  finalGuess: string | null;
  result: { winner: 'a' | 'b'; reason: 'correct' | 'incorrect' | 'outofquestions' } | null;
  round: number;
  scores: { a: number; b: number };
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

function answeredCount(log: QA[]): number {
  return log.filter((q) => q.answer !== null).length;
}

/** What a viewer is allowed to see. The secret is only revealed to the thinker or once ended. */
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
  const { colors, radius } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  const [secretDraft, setSecretDraft] = useState('');
  const [questionDraft, setQuestionDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');

  const logScrollRef = useRef<ScrollView | null>(null);

  const broadcast = useCallback((s: State) => {
    sendRef.current({ type: 'sync', state: publicView(s, 'b') });
  }, []);

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

  const applyAskQuestion = useCallback(
    (player: 'a' | 'b', question: string) => {
      const s = stateRef.current;
      if (s.phase !== 'asking') return;
      if (player === s.thinker) return;
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
        const next: State = { ...initialState(), thinker: cur.thinker };
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

  const { role, partnerHere, send } = useGameSession('twenty-questions', handleMessage);
  roleRef.current = role;
  sendRef.current = send;

  useEffect(() => {
    if (role === 'b') send({ type: 'hello' });
  }, [role, send]);

  useEffect(() => {
    const wasHere = partnerHereRef.current;
    partnerHereRef.current = partnerHere;
    if (role === 'a' && partnerHere && !wasHere) {
      broadcast(stateRef.current);
    }
  }, [partnerHere, role, broadcast]);

  useEffect(() => {
    setQuestionDraft('');
    setGuessDraft('');
  }, [state.round]);
  useEffect(() => {
    if (state.phase === 'setup') setSecretDraft('');
  }, [state.phase, state.round]);

  useEffect(() => {
    logScrollRef.current?.scrollToEnd({ animated: true });
  }, [state.log.length, state.pending, state.phase]);

  const isThinker = role === state.thinker;
  const guesserRole: 'a' | 'b' = state.thinker === 'a' ? 'b' : 'a';

  const dispatch = (hostFn: () => void, action: Record<string, unknown>) => {
    if (role === 'a') hostFn();
    else send({ type: 'action', action });
  };

  const onSetSecret = () => {
    const clean = secretDraft.trim();
    if (!clean) return;
    dispatch(() => applySetSecret('a', clean), { kind: 'secret', secret: clean });
  };

  const onSuggestIdea = () => {
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
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>💭</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const used = answeredCount(state.log);
  const remaining = MAX_QUESTIONS - used;
  const myScore = state.scores[role];
  const partnerScore = state.scores[guesserRole === role ? state.thinker : guesserRole];

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

  const bannerEnded = state.phase === 'ended';
  const bannerWon = state.result?.winner === role;
  const bannerBorder = bannerEnded ? (bannerWon ? colors.success : colors.error) : colors.border;
  const bannerBg = bannerEnded && bannerWon ? colors.surfaceHover : colors.surface;
  const bannerColor = bannerEnded ? (bannerWon ? colors.success : colors.error) : colors.text;

  return (
    <View style={{ width: '100%', maxWidth: 540, alignSelf: 'center', gap: 16 }}>
      {/* Scoreboard */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <ScorePill label="You" value={myScore} best={state.bestQuestions[role]} highlight />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: 8,
            paddingVertical: 10,
          }}
        >
          <AppText variant="caption" muted>Round</AppText>
          <AppText variant="title">{state.round}</AppText>
        </View>
        <ScorePill
          label="Partner"
          value={partnerScore}
          best={state.bestQuestions[guesserRole === role ? state.thinker : guesserRole]}
        />
      </View>

      {/* Role / phase banner */}
      <View
        style={{
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: bannerBorder,
          backgroundColor: bannerBg,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <AppText center variant="label" style={{ color: bannerColor }}>
          {banner}
          {state.phase !== 'setup' && state.phase !== 'ended' && (
            <AppText
              variant="label"
              weight="700"
              style={{ color: remaining <= 5 ? colors.error : colors.textMuted }}
            >
              {`  · ${remaining} ${remaining === 1 ? 'question' : 'questions'} left`}
            </AppText>
          )}
        </AppText>
      </View>

      {/* Q&A log */}
      {(state.log.length > 0 || state.phase !== 'setup') && (
        <Card variant="bordered" padded={false}>
          <ScrollView
            ref={logScrollRef}
            style={{ maxHeight: 256 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}
          >
            {state.log.length === 0 ? (
              <AppText center muted style={{ paddingVertical: 16 }}>
                No questions yet — the guesser goes first.
              </AppText>
            ) : (
              state.log.map((qa, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <AppText variant="caption" weight="700" muted style={{ marginTop: 2 }}>Q{i + 1}</AppText>
                    <AppText style={{ flex: 1 }}>{qa.question}</AppText>
                  </View>
                  {qa.answer && (
                    <View style={{ marginLeft: 28 }}>
                      <AnswerBadge answer={qa.answer} />
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </Card>
      )}

      {/* Secret display for the thinker (own client only) */}
      {isThinker && state.phase !== 'setup' && state.secret ? (
        <AppText center variant="caption" muted>
          Your secret: <AppText variant="caption" weight="700" style={{ color: colors.primary }}>{state.secret}</AppText>
        </AppText>
      ) : null}

      {/* ===== Phase controls ===== */}

      {/* SETUP: thinker picks the secret */}
      {state.phase === 'setup' && isThinker && (
        <View style={{ gap: 12 }}>
          <TextInput
            value={secretDraft}
            onChangeText={setSecretDraft}
            onSubmitEditing={onSetSecret}
            placeholder="A person, place, or thing…"
            placeholderTextColor={colors.textMuted}
            maxLength={80}
            autoFocus
            style={inputStyle(colors, radius)}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Button variant="ghost" onPress={onSuggestIdea} label="💡 Need an idea?" />
            <Button variant="primary" onPress={onSetSecret} disabled={!secretDraft.trim()} label="Start round" />
          </View>
        </View>
      )}

      {state.phase === 'setup' && !isThinker && (
        <Card variant="elevated" style={{ alignItems: 'center' }}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 20 }}>
            <AppText style={{ fontSize: 34 }}>💭</AppText>
            <AppText muted>Your partner is thinking of something…</AppText>
          </View>
        </Card>
      )}

      {/* ASKING: guesser types a question OR makes a final guess */}
      {state.phase === 'asking' && !isThinker && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TextInput
              value={questionDraft}
              onChangeText={setQuestionDraft}
              onSubmitEditing={onAsk}
              placeholder="Ask a yes/no question…"
              placeholderTextColor={colors.textMuted}
              maxLength={120}
              style={[inputStyle(colors, radius), { flex: 1 }]}
            />
            <Button variant="primary" onPress={onAsk} disabled={!questionDraft.trim()} label="Ask" />
          </View>
          <FinalGuessRow value={guessDraft} onChange={setGuessDraft} onSubmit={onFinalGuess} />
        </View>
      )}

      {state.phase === 'asking' && isThinker && (
        <AppText center muted>Waiting for your partner to ask a question…</AppText>
      )}

      {/* ANSWERING: thinker answers the pending question */}
      {state.phase === 'answering' && isThinker && state.pending && (
        <View style={{ gap: 12 }}>
          <Card variant="elevated">
            <AppText center>
              <AppText muted>They asked: </AppText>
              <AppText weight="600">{state.pending}</AppText>
            </AppText>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ANSWER_OPTIONS.map((opt) => (
              <Button
                key={opt}
                variant="secondary"
                onPress={() => onAnswer(opt)}
                label={ANSWER_LABELS[opt]}
                style={{ flexGrow: 1, flexBasis: '46%' }}
              />
            ))}
          </View>
        </View>
      )}

      {state.phase === 'answering' && !isThinker && (
        <AppText center muted>Waiting for your partner to answer…</AppText>
      )}

      {/* JUDGING: thinker marks the final guess */}
      {state.phase === 'judging' && (
        <Card variant="elevated" style={{ gap: 12 }}>
          <AppText center>
            <AppText muted>Final guess: </AppText>
            <AppText weight="700">{state.finalGuess}</AppText>
          </AppText>
          {isThinker ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button variant="primary" onPress={() => onVerdict(true)} label="✅ Correct" style={{ flex: 1 }} />
              <Button variant="secondary" onPress={() => onVerdict(false)} label="❌ Incorrect" style={{ flex: 1 }} />
            </View>
          ) : (
            <AppText center muted>Waiting for your partner to judge your guess…</AppText>
          )}
        </Card>
      )}

      {/* ENDED: reveal + result + next round */}
      {state.phase === 'ended' && (
        <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 12 }}>
          <Card variant="elevated" style={{ alignItems: 'center' }}>
            <View style={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}>
              <AppText muted center>
                {state.result?.reason === 'correct'
                  ? `Guessed in ${used} ${used === 1 ? 'question' : 'questions'}!`
                  : state.result?.reason === 'outofquestions'
                    ? 'Out of questions!'
                    : 'Wrong final guess!'}
              </AppText>
              <AppText center>
                The answer was <AppText weight="700" style={{ color: colors.primary }}>{state.secret}</AppText>
              </AppText>
            </View>
          </Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            <Button variant="primary" onPress={onNextRound} label="Next round (swap roles)" />
            <Button variant="ghost" onPress={onPlayAgain} label="Reset scores" />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useTheme>['colors'], radius: ReturnType<typeof useTheme>['radius']) {
  return {
    height: 46,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15,
  } as const;
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
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: 12,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="Ready to guess? Type your answer…"
        placeholderTextColor={colors.textMuted}
        maxLength={80}
        style={[inputStyle(colors, radius), { flex: 1, backgroundColor: colors.surfaceHover }]}
      />
      <Button variant="secondary" onPress={onSubmit} disabled={!value.trim()} label="Final guess" />
    </View>
  );
}

function AnswerBadge({ answer }: { answer: Answer }) {
  const { colors } = useTheme();
  const tone =
    answer === 'yes' ? colors.success : answer === 'no' ? colors.error : colors.textMuted;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tone,
        paddingHorizontal: 10,
        paddingVertical: 2,
      }}
    >
      <AppText variant="caption" weight="600" style={{ color: tone }}>{ANSWER_LABELS[answer]}</AppText>
    </View>
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
      <AppText variant="title">{value}</AppText>
      {best !== null && <AppText variant="caption" muted>best {best}Q</AppText>}
    </View>
  );
}
