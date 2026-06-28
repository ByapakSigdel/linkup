import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from '@/components/ui';
import { LinkupMark } from '@/components/brand-mark';

/**
 * A calm farewell shown after an account is wound down. No data, no network —
 * the session is already cleared. Just a gentle send-off back to the front door.
 */
export default function GoodbyeScreen() {
  const theme = useTheme();
  const { colors, fonts } = theme;

  // Honor the OS reduce-motion setting for the entrance animations.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  const enter = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.duration(700).delay(delay);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <View style={styles.center}>
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(900)}>
            <LinkupMark size={40} />
          </Animated.View>

          <Animated.Text
            entering={enter(150)}
            style={{
              fontFamily: fonts.display,
              fontSize: 28 * theme.displayScale,
              lineHeight: 36 * theme.displayScale,
              letterSpacing: theme.headingTracking,
              color: colors.text,
              textAlign: 'center',
              marginTop: 28,
            }}
          >
            Take care of yourself.
          </Animated.Text>

          <Animated.Text
            entering={enter(320)}
            style={{
              fontFamily: fonts.body,
              fontSize: 15 * theme.bodyScale,
              lineHeight: 23 * theme.bodyScale,
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: 14,
              maxWidth: 340,
            }}
          >
            Your account has been wound down. Thank you for the moments you
            shared here — the door stays open whenever you want to begin again.
          </Animated.Text>

          <Animated.View entering={enter(520)} style={styles.action}>
            <Button
              label="Back to the start"
              onPress={() => router.replace('/welcome')}
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  action: { marginTop: 36, alignSelf: 'stretch', maxWidth: 320, width: '100%' },
});
