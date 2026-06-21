import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';

function Dot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0, { duration: 350 }),
          withTiming(0, { duration: 700 }),
        ),
        -1,
        false,
      ),
    );
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + t.value * 0.65,
    transform: [{ translateY: -t.value * 3 }],
  }));
  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
        style,
      ]}
    />
  );
}

export function TypingIndicator({ partnerName }: { partnerName?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={200} />
        <Dot delay={400} />
      </View>
      <AppText variant="caption" muted weight="600">
        {partnerName ? `${partnerName} is typing…` : 'Typing…'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
