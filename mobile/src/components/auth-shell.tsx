import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkupLockup } from '@/components/brand-mark';
import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * Branded auth card shell. Port of apps/web AuthFormWrapper:
 * starlight hairline accent, constellation lockup, mono eyebrow, serif title.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const { colors, radius } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(450).springify().damping(18)}
            style={{
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: 24,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.35,
              shadowRadius: 28,
              shadowOffset: { width: 0, height: 16 },
              elevation: 6,
            }}
          >
            {/* Hairline starlight accent across the top edge. */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: colors.primary,
                opacity: 0.4,
              }}
            />

            <View style={{ marginBottom: 24 }}>
              <View style={{ marginBottom: 22 }}>
                <LinkupLockup markSize={26} />
              </View>

              {eyebrow ? (
                <AppText
                  style={{
                    marginBottom: 8,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 3.4,
                    color: colors.accent,
                    fontWeight: '600',
                  }}
                >
                  {eyebrow}
                </AppText>
              ) : null}

              <AppText variant="display" style={{ fontSize: 28, fontWeight: '700' }}>
                {title}
              </AppText>

              {description ? (
                <AppText muted style={{ marginTop: 8, lineHeight: 21 }}>
                  {description}
                </AppText>
              ) : null}
            </View>

            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Inline alert banner (error / success), styled like the web variants. */
export function AuthBanner({ kind, message }: { kind: 'error' | 'success'; message: string }) {
  const { colors, radius } = useTheme();
  const tone = kind === 'error' ? colors.error : colors.success;
  return (
    <View
      style={{
        borderRadius: radius.input,
        borderWidth: 1,
        borderColor: tone,
        backgroundColor: tone + '1A',
        paddingHorizontal: 14,
        paddingVertical: 11,
      }}
    >
      <AppText color={tone} style={{ fontSize: 13 }}>
        {message}
      </AppText>
    </View>
  );
}
