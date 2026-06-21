import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useGameSession } from '@/hooks/use-game-session';
import { useTheme } from '@/theme';
import { AppText, Button, Card } from '@/components/ui';

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
  turn: 'a' | 'b';
  choice: Choice | null;
  promptIndex: number | null;
  completed: number;
}

function initialState(): State {
  return { turn: 'a', choice: null, promptIndex: null, completed: 0 };
}

const randIndex = (len: number) => Math.floor(Math.random() * len);

export function TruthOrDare() {
  const { colors } = useTheme();
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const roleRef = useRef<'a' | 'b'>('a');
  const partnerHereRef = useRef(false);
  const sendRef = useRef<(data: unknown) => void>(() => {});

  const applyChoice = useCallback((player: 'a' | 'b', choice: Choice) => {
    const s = stateRef.current;
    if (s.turn !== player || s.choice !== null) return;
    const len = choice === 'truth' ? TRUTHS.length : DARES.length;
    const next: State = { ...s, choice, promptIndex: randIndex(len) };
    setState(next);
    sendRef.current({ type: 'sync', state: next });
  }, []);

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
        action?: { kind: 'choice'; choice: Choice } | { kind: 'finish'; done: boolean };
      };
      const role = roleRef.current;

      if (role === 'b') {
        if (msg.type === 'sync' && msg.state) setState(msg.state);
        return;
      }

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
      <Card variant="elevated" style={{ alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <AppText style={{ fontSize: 40 }}>🎯</AppText>
          <AppText muted>Waiting for your partner to join…</AppText>
        </View>
      </Card>
    );
  }

  const prompt =
    state.choice !== null && state.promptIndex !== null
      ? (state.choice === 'truth' ? TRUTHS : DARES)[state.promptIndex]
      : null;

  return (
    <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center', gap: 20 }}>
      {/* Turn banner + tally */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: myTurn ? colors.primary : colors.surface,
            borderWidth: myTurn ? 0 : 1,
            borderColor: colors.border,
          }}
        >
          <AppText variant="label" style={{ color: myTurn ? colors.textOnPrimary : colors.textMuted }}>
            {myTurn ? 'Your turn' : "Partner's turn"}
          </AppText>
        </View>
        <AppText variant="caption" muted>
          Rounds: <AppText variant="caption" weight="700">{state.completed}</AppText>
        </AppText>
      </View>

      {/* Choosing phase */}
      {state.choice === null && (
        <Card variant="elevated" style={{ alignItems: 'center', gap: 20 }}>
          <AppText style={{ fontSize: 40 }}>🎯</AppText>
          {myTurn ? (
            <>
              <AppText muted>Truth or Dare?</AppText>
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <Button variant="primary" style={{ flex: 1 }} onPress={() => pick('truth')} label="Truth" />
                <Button variant="secondary" style={{ flex: 1 }} onPress={() => pick('dare')} label="Dare" />
              </View>
            </>
          ) : (
            <AppText muted center>Waiting for your partner to choose Truth or Dare…</AppText>
          )}
        </Card>
      )}

      {/* Reveal phase */}
      {state.choice !== null && prompt && (
        <Animated.View entering={FadeInDown.duration(500)} style={{ gap: 16 }}>
          <Card variant="elevated" style={{ alignItems: 'center', gap: 16 }}>
            <View
              style={{
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 5,
                backgroundColor: state.choice === 'truth' ? colors.primary : colors.secondary,
              }}
            >
              <AppText
                variant="caption"
                weight="800"
                style={{ color: colors.textOnPrimary, textTransform: 'uppercase', letterSpacing: 1 }}
              >
                {state.choice}
              </AppText>
            </View>
            <AppText center variant="subtitle" weight="600">{prompt}</AppText>
            <AppText variant="caption" muted>
              {myTurn ? "It's your prompt 💫" : 'Your partner is up'}
            </AppText>
          </Card>

          {myTurn ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
              <Button variant="primary" onPress={() => end(true)} label="Done ✓" />
              <Button variant="outline" onPress={() => end(false)} label="Skip" />
            </View>
          ) : (
            <AppText center muted>Cheer your partner on…</AppText>
          )}
        </Animated.View>
      )}
    </View>
  );
}
