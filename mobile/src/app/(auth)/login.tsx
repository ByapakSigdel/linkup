import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';

import { AuthBanner, AuthShell } from '@/components/auth-shell';
import { AppText, Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { apiErrorMessage } from '@/lib/api';
import { useTheme } from '@/theme';

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { colors } = useTheme();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');

  async function handleSubmit() {
    setFieldErrors({});
    setApiError('');

    const errors: FieldErrors = {};
    if (!EMAIL_RE.test(email)) errors.email = 'Invalid email address';
    if (!password) errors.password = 'Password is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await login(email, password);
      router.replace('/dashboard');
    } catch (err) {
      setApiError(
        apiErrorMessage(err, 'Invalid email or password. Please try again.'),
      );
    }
  }

  return (
    <AuthShell
      eyebrow="sign in"
      title="Welcome back"
      description="Step back into the sky you share."
    >
      <View style={{ gap: 16 }}>
        {apiError ? <AuthBanner kind="error" message={apiError} /> : null}

        <Input
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          editable={!isLoading}
        />

        <View>
          <Input
            label="Password"
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            editable={!isLoading}
            style={{ paddingRight: 44 }}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={10}
            style={{ position: 'absolute', right: 12, top: 34 }}
          >
            {showPassword ? (
              <EyeOff color={colors.textMuted} size={18} />
            ) : (
              <Eye color={colors.textMuted} size={18} />
            )}
          </Pressable>
        </View>

        <Button
          label="Log In"
          size="lg"
          fullWidth
          loading={isLoading}
          onPress={handleSubmit}
          style={{ marginTop: 4 }}
        />
      </View>

      <View style={{ marginTop: 24, flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
        <AppText muted style={{ fontSize: 13 }}>
          Don&apos;t have an account?
        </AppText>
        <Pressable onPress={() => router.push('/(auth)/register')}>
          <AppText color={colors.primary} style={{ fontSize: 13, fontWeight: '600' }}>
            Sign up
          </AppText>
        </Pressable>
      </View>
    </AuthShell>
  );
}
