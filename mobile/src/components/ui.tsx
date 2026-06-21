import React from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useTheme } from '@/theme';

/* ─── Screen ──────────────────────────────────────────────────────────────── */
export function Screen({
  children,
  scroll,
  padded = true,
  edges = ['top'],
  contentStyle,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const pad: ViewStyle = padded ? { padding: 16 } : {};
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, { flexGrow: 1 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/* ─── Text ────────────────────────────────────────────────────────────────── */
type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';
const TEXT_SIZES: Record<TextVariant, TextStyle> = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
};

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
  const { colors } = useTheme();
  return (
    <Text
      style={[
        TEXT_SIZES[variant],
        { color: color ?? (muted ? colors.textMuted : colors.text) },
        weight ? { fontWeight: weight } : null,
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
  const { colors, radius } = useTheme();
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
    : variant === 'secondary' ? colors.text
    : colors.text;
  const border =
    variant === 'outline' ? colors.border : 'transparent';

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: heights[size],
          borderRadius: radius.button,
          backgroundColor: bg,
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 18,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {leftIcon}
          {label ? (
            <Text style={{ color: fg, fontSize: fonts[size], fontWeight: '700' }}>{label}</Text>
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
  const { colors, radius, isLight } = useTheme();
  const elevated: ViewStyle =
    variant === 'elevated'
      ? {
          shadowColor: '#000',
          shadowOpacity: isLight ? 0.08 : 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
        }
      : {};
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderWidth: variant === 'flat' ? 0 : 1,
          borderColor: colors.border,
          padding: padded ? 16 : 0,
        },
        elevated,
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
  const { colors, radius } = useTheme();
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
            fontSize: 15,
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
  const { colors } = useTheme();
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
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: size * 0.38 }}>
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
  const { colors } = useTheme();
  const bg =
    variant === 'success' ? colors.success
    : variant === 'error' ? colors.error
    : variant === 'muted' ? colors.surfaceHover
    : colors.primary;
  const fg = variant === 'muted' ? colors.text : colors.textOnPrimary;
  return (
    <View style={{ minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '800' }}>{label}</Text>
    </View>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────────────────── */
export function Spinner({ size = 'large', color }: { size?: 'small' | 'large'; color?: string }) {
  const { colors } = useTheme();
  return <ActivityIndicator size={size} color={color ?? colors.primary} />;
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <Spinner />
      {label ? <AppText muted>{label}</AppText> : null}
      <View style={{ position: 'absolute' }} pointerEvents="none">
        <View style={{ width: 0, height: 0, backgroundColor: colors.background }} />
      </View>
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

/* ─── Pressable helper with scale feedback ────────────────────────────────── */
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
