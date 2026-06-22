import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff, Check, ArrowRight } from 'lucide-react-native';
import { useAuthStore } from '@/stores/auth-store';
import { useResponsive } from '@/hooks/use-responsive';
import { apiErrorMessage } from '@/lib/api';
import { CELESTIAL as C, CELESTIAL_FONTS as F } from '@/theme/celestial';
import { LinkupMark } from '@/components/brand-mark';
import { ConstellationSky } from '@/components/brand/constellation-sky';
import { ConstellationOfTwo } from '@/components/brand/constellation-of-two';

type AuthMode = 'login' | 'signup';

export default function FrontDoor() {
  const params = useLocalSearchParams<{ to?: string; mode?: string }>();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<AuthMode>(params.mode === 'signup' ? 'signup' : 'login');

  const goTo = useCallback(
    (p: number) => pagerRef.current?.scrollTo({ x: p * width, animated: true }),
    [width],
  );

  const openAuth = useCallback(
    (m: AuthMode) => {
      setMode(m);
      goTo(1);
    },
    [goTo],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const p = Math.round(e.nativeEvent.contentOffset.x / width);
      if (p !== page) setPage(p);
    },
    [page, width],
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <ConstellationSky />

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        keyboardShouldPersistTaps="handled"
        contentOffset={params.to === 'auth' ? { x: width, y: 0 } : undefined}
      >
        <View style={{ width }}>
          <Landing onLogin={() => openAuth('login')} onSignup={() => openAuth('signup')} />
        </View>
        <View style={{ width }}>
          <AuthPanel mode={mode} setMode={setMode} onBack={() => goTo(0)} />
        </View>
      </ScrollView>

      {/* Page dots */}
      <SafeAreaView edges={['bottom']} style={{ position: 'absolute', bottom: 10, left: 0, right: 0 }}>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                width: i === page ? 22 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === page ? C.primary : C.borderStrong,
              }}
            />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

/* ─── Landing (page 0) ────────────────────────────────────────────────────── */
function Landing({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const { isTablet, isWide, isLandscape } = useResponsive();
  // Two-column hero on wide screens (mirrors the web's lg:grid-cols layout),
  // especially in landscape. Phones keep the single-column stack.
  const twoCol = isWide || (isTablet && isLandscape);
  const h1Style = isTablet ? [styles.h1, styles.h1Tablet] : styles.h1;

  const eyebrow = (
    <Animated.Text
      entering={FadeInDown.duration(700).delay(100)}
      style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 3.4, textTransform: 'uppercase', color: C.accent, opacity: 0.85, marginBottom: 14 }}
    >
      made for the hours between midnight & dawn
    </Animated.Text>
  );

  const headline = (
    <>
      <Animated.Text entering={FadeInDown.duration(700).delay(200)} style={h1Style}>
        A constellation
      </Animated.Text>
      <Animated.Text entering={FadeInDown.duration(700).delay(350)} style={h1Style}>
        of <Animated.Text style={[h1Style, { color: C.primary, fontStyle: 'italic' }]}>two</Animated.Text>.
      </Animated.Text>
    </>
  );

  const paragraph = (
    <Animated.Text
      entering={FadeInDown.duration(700).delay(500)}
      style={{ fontFamily: F.body, fontSize: isTablet ? 17 : 16, lineHeight: isTablet ? 26 : 24, color: C.textMuted, marginTop: 18, maxWidth: 460 }}
    >
      A private sky for you and the one you orbit. Chat, create, and keep every moment between the two of you — and no one else.
    </Animated.Text>
  );

  const cta = (
    <Animated.View entering={FadeInDown.duration(700).delay(650)} style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 28, flexWrap: 'wrap' }}>
      <Pressable
        onPress={onSignup}
        style={({ pressed }) => ({
          height: 50,
          borderRadius: 999,
          backgroundColor: C.primary,
          paddingHorizontal: 28,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Animated.Text style={{ fontFamily: F.bodyMedium, fontSize: 15, color: C.textOnPrimary, letterSpacing: 0.3 }}>
          Begin your sky
        </Animated.Text>
        <ArrowRight size={17} color={C.textOnPrimary} />
      </Pressable>
    </Animated.View>
  );

  const constellation = (
    <Animated.View entering={FadeIn.duration(1400).delay(300)} style={{ alignItems: 'center' }}>
      <ConstellationOfTwo />
    </Animated.View>
  );

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: twoCol ? 48 : 24, alignSelf: 'center', width: '100%', maxWidth: twoCol ? 1040 : undefined }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LinkupMark size={26} />
            <Wordmark size={16} />
          </View>
          <Pressable onPress={onLogin} hitSlop={10}>
            <Animated.Text
              style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: C.textMuted }}
            >
              log in
            </Animated.Text>
          </Pressable>
        </View>

        {/* Hero */}
        {twoCol ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 48, paddingVertical: 24 }}>
            {/* Words (left) */}
            <View style={{ flex: 1.05 }}>
              {eyebrow}
              {headline}
              {paragraph}
              {cta}
            </View>
            {/* Constellation (right) */}
            <View style={{ flex: 0.95 }}>{constellation}</View>
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', gap: 4, paddingVertical: 12 }}>
            <View style={{ marginBottom: 8 }}>{constellation}</View>
            {eyebrow}
            {headline}
            {paragraph}
            {cta}
          </View>
        )}

        {/* Ephemeris footer */}
        <Animated.View
          entering={FadeIn.duration(1400).delay(1100)}
          style={{ borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 18, gap: 6 }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <FootText>two stars · one bond</FootText>
            <FootText>linkup © 2026</FootText>
          </View>
          <FootText>no group chats · just the two of you</FootText>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FootText({ children }: { children: string }) {
  return (
    <Animated.Text style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: 2.6, textTransform: 'uppercase', color: C.textMuted }}>
      {children}
    </Animated.Text>
  );
}

function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <Animated.Text style={{ fontFamily: F.body, fontSize: size, fontWeight: '300', letterSpacing: size * 0.32, color: C.text }}>
      linkup
    </Animated.Text>
  );
}

/* ─── Auth (page 1) ───────────────────────────────────────────────────────── */
function AuthPanel({
  mode,
  setMode,
  onBack,
}: {
  mode: AuthMode;
  setMode: (m: AuthMode) => void;
  onBack: () => void;
}) {
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    setError('');
    try {
      if (mode === 'login') {
        if (!email || !password) return setError('Enter your email and password.');
        await login(email.trim(), password);
        router.replace('/dashboard');
      } else {
        if (!email || !username || !displayName || !password) return setError('Please fill in every field.');
        if (password !== confirm) return setError('Passwords do not match.');
        if (!agree) return setError('Please agree to the Terms to continue.');
        await register({ email: email.trim(), username: username.trim(), displayName: displayName.trim(), password });
        // Finish sign-up by entering the OTP we just emailed.
        router.replace('/verify');
      }
    } catch (e) {
      setError(apiErrorMessage(e, mode === 'login' ? 'Invalid email or password.' : 'Could not create your account.'));
    }
  }, [mode, email, username, displayName, password, confirm, agree, login, register]);

  const eyebrow = mode === 'login' ? 'sign in' : 'new sky';
  const title = mode === 'login' ? 'Welcome back' : 'Find your other star';
  const desc =
    mode === 'login'
      ? 'Step back into the sky you share.'
      : 'Create your account, then link up with the one you orbit.';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View
            entering={FadeInDown.duration(700)}
            style={{
              borderRadius: 22,
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: 'rgba(27,32,43,0.82)',
              padding: 26,
              overflow: 'hidden',
              width: '100%',
              maxWidth: 460,
              alignSelf: 'center',
            }}
          >
            {/* top hairline accent */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: C.primary, opacity: 0.4 }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <LinkupMark size={24} />
              <Wordmark size={14} />
            </View>

            <Animated.Text style={{ fontFamily: F.mono, fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase', color: C.accent, opacity: 0.85, marginBottom: 6 }}>
              {eyebrow}
            </Animated.Text>
            <Animated.Text style={{ fontFamily: F.serif, fontSize: 30, color: C.text, lineHeight: 34 }}>{title}</Animated.Text>
            <Animated.Text style={{ fontFamily: F.body, fontSize: 14, color: C.textMuted, marginTop: 6, lineHeight: 20 }}>{desc}</Animated.Text>

            {/* Toggle */}
            <View style={{ flexDirection: 'row', backgroundColor: C.surfaceActive, borderRadius: 999, padding: 4, marginTop: 18, marginBottom: 6 }}>
              {(['login', 'signup'] as AuthMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => { setMode(m); setError(''); }}
                  style={{ flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? C.primary : 'transparent' }}
                >
                  <Animated.Text style={{ fontFamily: F.bodyMedium, fontSize: 13, color: mode === m ? C.textOnPrimary : C.textMuted }}>
                    {m === 'login' ? 'Log in' : 'Sign up'}
                  </Animated.Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <View style={{ borderRadius: 10, borderWidth: 1, borderColor: 'rgba(224,133,133,0.35)', backgroundColor: 'rgba(224,133,133,0.12)', paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 }}>
                <Animated.Text style={{ fontFamily: F.body, fontSize: 13, color: C.error }}>{error}</Animated.Text>
              </View>
            ) : null}

            <View style={{ gap: 14, marginTop: 14 }}>
              <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />

              {mode === 'signup' && (
                <>
                  <Field label="Username" value={username} onChange={setUsername} placeholder="your_username" autoCapitalize="none" />
                  <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Your Name" />
                </>
              )}

              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                secureTextEntry={!showPw}
                rightIcon={
                  <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8}>
                    {showPw ? <EyeOff size={17} color={C.textMuted} /> : <Eye size={17} color={C.textMuted} />}
                  </Pressable>
                }
              />

              {mode === 'signup' && (
                <>
                  <Field label="Confirm password" value={confirm} onChange={setConfirm} placeholder="Re-enter your password" secureTextEntry={!showPw} />
                  <Pressable onPress={() => setAgree((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: agree ? C.primary : C.border, backgroundColor: agree ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {agree ? <Check size={13} color={C.textOnPrimary} /> : null}
                    </View>
                    <Animated.Text style={{ fontFamily: F.body, fontSize: 13, color: C.textMuted, flex: 1 }}>
                      I agree to the Terms of Service and Privacy Policy
                    </Animated.Text>
                  </Pressable>
                </>
              )}
            </View>

            <Pressable
              onPress={submit}
              disabled={isLoading}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 14,
                backgroundColor: C.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 20,
                opacity: isLoading ? 0.6 : pressed ? 0.9 : 1,
              })}
            >
              <Animated.Text style={{ fontFamily: F.bodyBold, fontSize: 15, color: C.textOnPrimary }}>
                {isLoading ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}
              </Animated.Text>
            </Pressable>

            <Pressable onPress={onBack} hitSlop={8} style={{ marginTop: 16, alignSelf: 'center' }}>
              <Animated.Text style={{ fontFamily: F.body, fontSize: 13, color: C.textMuted }}>‹ Back to the sky</Animated.Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  rightIcon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  rightIcon?: React.ReactNode;
}) {
  return (
    <View>
      <Animated.Text style={{ fontFamily: F.bodyMedium, fontSize: 12.5, color: C.textMuted, marginBottom: 6 }}>{label}</Animated.Text>
      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{
            backgroundColor: C.background,
            borderWidth: 1,
            borderColor: C.border,
            borderRadius: 11,
            paddingHorizontal: 14,
            paddingVertical: 12,
            paddingRight: rightIcon ? 42 : 14,
            fontSize: 15,
            fontFamily: F.body,
            color: C.text,
          }}
        />
        {rightIcon ? <View style={{ position: 'absolute', right: 12 }}>{rightIcon}</View> : null}
      </View>
    </View>
  );
}

const styles = {
  h1: { fontFamily: F.serif, fontSize: 48, lineHeight: 50, color: C.text, letterSpacing: -0.5 } as const,
  h1Tablet: { fontSize: 64, lineHeight: 66 } as const,
};
