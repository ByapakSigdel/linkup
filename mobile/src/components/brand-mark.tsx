import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { AppText } from '@/components/ui';
import { useTheme } from '@/theme';

/**
 * The LinkUp constellation mark: two stars (amber + starlight) joined by a
 * periwinkle bond line, with a lilac "link point" sparkle at the centre.
 * Ported from apps/web/src/components/brand/logo.tsx.
 */
export function LinkupMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* bond line */}
      <Line x1="12" y1="32" x2="37" y2="15" stroke="#A8BFD4" strokeWidth="1.1" strokeLinecap="round" />
      {/* large star (amber) */}
      <Circle cx="12" cy="32" r="5.2" fill="#D4A574" />
      {/* small star (starlight) */}
      <Circle cx="37" cy="15" r="3.6" fill="#E8E4DC" />
      {/* link point — lilac sparkle */}
      <Path
        d="M24.5 18.2c.4 2.6 1.2 3.4 3.8 3.8-2.6.4-3.4 1.2-3.8 3.8-.4-2.6-1.2-3.4-3.8-3.8 2.6-.4 3.4-1.2 3.8-3.8Z"
        fill="#C4A8E0"
      />
    </Svg>
  );
}

/** Lowercase, wide-tracked wordmark. */
export function LinkupWordmark({ size = 14 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <AppText
      style={{
        fontSize: size,
        fontWeight: '300',
        letterSpacing: size * 0.32,
        color: colors.text,
      }}
    >
      linkup
    </AppText>
  );
}

/** Combined lockup: mark + wordmark. */
export function LinkupLockup({ markSize = 26 }: { markSize?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LinkupMark size={markSize} />
      <LinkupWordmark />
    </View>
  );
}
