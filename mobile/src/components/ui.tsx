import React from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme, type Theme } from '@/theme';
import { ThemedBackground } from '@/components/themed-background';

/* ─── Screen ──────────────────────────────────────────────────────────────── */
export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['top'],
  contentStyle,
  style,
  maxWidth,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  style?: ViewStyle;
  /** Center single-column content at this width on big (tablet) screens. */
  maxWidth?: number;
}) {
  const { colors } = useTheme();
  const pad: ViewStyle = padded ? { padding: 16 } : {};
  // Center the content column on wide screens so it doesn't sprawl edge-to-edge.
  const inner = maxWidth ? (
    <View style={{ width: '100%', maxWidth, alignSelf: 'center', flex: scroll ? undefined : 1 }}>
      {children}
    </View>
  ) : (
    children
  );
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      <ThemedBackground />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[pad, { flexGrow: 1 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            {inner}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, pad, contentStyle]}>{inner}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Text ────────────────────────────────────────────────────────────────── */
type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';
const SIZES: Record<TextVariant, number> = {
  display: 30,
  title: 22,
  subtitle: 17,
  body: 15,
  caption: 12,
  label: 13,
};

/** Resolve the themed font family for a body weight. */
function bodyFamily(theme: Theme, weight?: TextStyle['fontWeight']): string {
  if (!weight) return theme.fonts.body;
  const w = String(weight);
  if (w === 'bold' || w === '700' || w === '800' || w === '900') return theme.fonts.bodyBold;
  if (w === '600') return theme.fonts.bodySemibold;
  if (w === '500' || w === 'medium') return theme.fonts.bodyMedium;
  return theme.fonts.body;
}

export function AppText({
  variant = 'body',
  muted,
  color,
  weight,
  center,
  style,
  children,
  ...rest
}: TextProps & {
  variant?: TextVariant;
  muted?: boolean;
  color?: string;
  weight?: TextStyle['fontWeight'];
  center?: boolean;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const isHeading = variant === 'display' || variant === 'title' || variant === 'subtitle';

  let family: string;
  if (isHeading) family = theme.fonts.display;
  else if (variant === 'label') family = weight ? bodyFamily(theme, weight) : theme.fonts.bodyMedium;
  else family = bodyFamily(theme, weight);

  const scale = isHeading ? theme.displayScale : theme.bodyScale;
  const fontSize = SIZES[variant] * scale;
  const letterSpacing = isHeading ? theme.headingTracking : theme.bodyTracking;

  return (
    <Text
      style={[
        { fontFamily: family, fontSize, letterSpacing, color: color ?? (muted ? colors.textMuted : colors.text) },
        center ? { textAlign: 'center' } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

export const Heading = (p: React.ComponentProps<typeof AppText>) => (
  <AppText variant="title" {...p} />
);
export const Muted = (p: React.ComponentProps<typeof AppText>) => (
  <AppText variant="body" muted {...p} />
);

/* ─── Button ──────────────────────────────────────────────────────────────── */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  label,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  leftIcon,
  fullWidth,
  style,
}: {
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const { colors, radius, shape } = theme;
  const heights: Record<ButtonSize, number> = { sm: 38, md: 46, lg: 54 };
  const fonts: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 16 };

  const bg =
    variant === 'primary' ? colors.primary
    : variant === 'secondary' ? colors.surfaceHover
    : variant === 'destructive' ? colors.error
    : 'transparent';
  const fg =
    variant === 'primary' ? colors.textOnPrimary
    : variant === 'destructive' ? '#fff'
    : colors.text;

  const isDisabled = disabled || loading;
  const bordered = variant === 'outline' || (shape.uppercaseButtons && variant !== 'ghost');
  const borderColor = variant === 'outline' ? colors.border : colors.borderStrong;

  // Hard offset shadow on brutalist/arcade; subtle elsewhere for primary.
  const shadow: ViewStyle = shape.hardShadow && variant !== 'ghost'
    ? {
        shadowColor: shape.shadowColor,
        shadowOpacity: 1,
        shadowRadius: 0,
        shadowOffset: { width: 3, height: 3 },
        elevation: 0,
      }
    : {};

  const label2 = label && shape.uppercaseButtons ? label.toUpperCase() : label;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: heights[size],
          borderRadius: radius.button,
          backgroundColor: bg,
          borderWidth: bordered ? (shape.uppercaseButtons ? shape.borderWidth : 1) : 0,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 18,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : undefined,
        },
        shadow,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {leftIcon}
          {label2 ? (
            <Text
              style={{
                color: fg,
                fontSize: fonts[size] * theme.bodyScale,
                fontFamily: theme.fonts.bodyBold,
                letterSpacing: shape.uppercaseButtons ? 1 : 0.2,
              }}
            >
              {label2}
            </Text>
          ) : (
            children
          )}
        </>
      )}
    </Pressable>
  );
}

/* ─── Card ────────────────────────────────────────────────────────────────── */
export function Card({
  children,
  variant = 'bordered',
  style,
  padded = true,
  ...rest
}: ViewProps & {
  variant?: 'bordered' | 'elevated' | 'flat';
  padded?: boolean;
}) {
  const { colors, radius, shape } = useTheme();

  const showShadow = variant === 'elevated' && (shape.shadowOpacity > 0 || shape.hardShadow);
  const shadowStyle: ViewStyle = showShadow
    ? {
        shadowColor: shape.shadowColor,
        shadowOpacity: shape.shadowOpacity,
        shadowRadius: shape.shadowRadius,
        shadowOffset: shape.shadowOffset,
        elevation: shape.elevation,
      }
    : {};

  // brutalist/arcade use the strong border; loveletter keeps its tilt + normal border.
  const strongBorder = shape.hardShadow && shape.cardRotate === 0;

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: variant === 'flat' ? 0 : shape.borderWidth,
          borderColor: strongBorder ? colors.borderStrong : colors.border,
          padding: padded ? 16 : 0,
        },
        shape.cardRotate ? { transform: [{ rotate: `${shape.cardRotate}deg` }] } : null,
        shadowStyle,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/* ─── Input ───────────────────────────────────────────────────────────────── */
export function Input({
  label,
  error,
  style,
  containerStyle,
  ...rest
}: TextInputProps & { label?: string; error?: string; containerStyle?: ViewStyle }) {
  const theme = useTheme();
  const { colors, radius } = theme;
  return (
    <View style={containerStyle}>
      {label ? (
        <AppText variant="label" muted style={{ marginBottom: 6 }}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          {
            backgroundColor: colors.background,
            borderColor: error ? colors.error : colors.border,
            borderWidth: 1,
            borderRadius: radius.input,
            paddingHorizontal: 14,
            paddingVertical: 12,
            fontSize: 15 * theme.bodyScale,
            fontFamily: theme.fonts.body,
            color: colors.text,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" color={colors.error} style={{ marginTop: 4 }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

/* ─── Avatar ──────────────────────────────────────────────────────────────── */
export function Avatar({
  uri,
  name,
  size = 44,
  online,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
  online?: boolean;
}) {
  const theme = useTheme();
  const { colors } = theme;
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHover }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.primary, fontFamily: theme.fonts.bodyBold, fontSize: size * 0.36 }}>
            {initials}
          </Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: size * 0.14,
            backgroundColor: online ? colors.success : colors.textMuted,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        />
      )}
    </View>
  );
}

/* ─── Badge ───────────────────────────────────────────────────────────────── */
export function Badge({
  label,
  variant = 'primary',
}: {
  label: string | number;
  variant?: 'primary' | 'success' | 'error' | 'muted';
}) {
  const theme = useTheme();
  const { colors } = theme;
  const bg =
    variant === 'success' ? colors.success
    : variant === 'error' ? colors.error
    : variant === 'muted' ? colors.surfaceHover
    : colors.primary;
  const fg = variant === 'muted' ? colors.text : colors.textOnPrimary;
  return (
    <View style={{ minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: 11, fontFamily: theme.fonts.bodyBold }}>{label}</Text>
    </View>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 'large', color }: { size?: 'small' | 'large'; color?: string }) {
  const { colors } = useTheme();
  return <ActivityIndicator size={size} color={color ?? colors.primary} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Spinner />
      {label ? <AppText muted>{label}</AppText> : null}
    </View>
  );
}

/* ─── Divider ─────────────────────────────────────────────────────────────── */
export function Divider({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

/* ─── Row ─────────────────────────────────────────────────────────────────── */
export function Row({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/* ─── EmptyState ──────────────────────────────────────────────────────────── */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
      {icon}
      <AppText variant="subtitle" center>{title}</AppText>
      {subtitle ? <AppText muted center style={{ maxWidth: 320 }}>{subtitle}</AppText> : null}
      {action ? <View style={{ marginTop: 12 }}>{action}</View> : null}
    </View>
  );
}

/* ─── Skeleton (shimmer) ──────────────────────────────────────────────────── */
export function Skeleton({ width, height = 16, radius = 8, style }: { width?: number | string; height?: number; radius?: number; style?: ViewStyle }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.4, { duration: 700 })), -1, true);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { width: (width as number) ?? '100%', height, borderRadius: radius, backgroundColor: colors.surfaceHover },
        animStyle,
        style,
      ]}
    />
  );
}

/* ─── Pressable helper with opacity feedback ──────────────────────────────── */
export function Touchable({ children, style, onPress, ...rest }: PressableProps & { style?: ViewStyle }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, style]}
      {...rest}
    >
      {children as React.ReactNode}
    </Pressable>
  );
}
