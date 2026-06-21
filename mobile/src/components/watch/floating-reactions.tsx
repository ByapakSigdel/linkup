import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui';
import type { FloatingReaction } from './types';

/**
 * One emoji that rises and fades out, mirroring the web `watchReactionFloat`
 * keyframes: drift up ~180px, scale 0.8 → 1.3, fade in then out over 2.2s.
 */
function Floater({ reaction }: { reaction: FloatingReaction }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Opacity: 0 → 1 by 15%, then back to 0 by 100%.
    const opacity = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
    return {
      transform: [
        { translateY: -180 * p },
        { scale: 0.8 + 0.5 * p },
      ],
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: 24,
          left: `${reaction.left}%`,
        },
        style,
      ]}
      pointerEvents="none"
    >
      <AppText style={{ fontSize: 36 }}>{reaction.emoji}</AppText>
    </Animated.View>
  );
}

export function FloatingReactions({ reactions }: { reactions: FloatingReaction[] }) {
  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      pointerEvents="none"
    >
      {reactions.map((r) => (
        <Floater key={r.id} reaction={r} />
      ))}
    </View>
  );
}
