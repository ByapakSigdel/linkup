import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';

import { AuthBanner, AuthShell } from '@/components/auth-shell';
import { AppText, Button, Input } from '@/components/ui';
import api, { apiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/theme';

const RESEND_COOLDOWN = 60; // seconds

export default function VerifyScreen() {
  const { colors } = useTheme();
  const email = useAuthStore((s) => s.user?.email);

  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/auth/verify/resend', { email });
      setSuccess('A new verification code has been sent to your email.');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to resend code. Please try again.'));
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending]);

  async function handleSubmit() {
    setError('');
    setSuccess('');

    const trimmed = code.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    if (!email) {
      setError('Your session expired. Please log in or sign up again.');
      return;
    }

    setIsVerifying(true);
    try {
      await api.post('/auth/verify', { email, code: trimmed });
      router.replace('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid or expired code. Please try again.'));
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <AuthShell
      eyebrow="verify email"
      title="Check your email"
      description="We sent a 6-digit verification code to your email address"
    >
      {/* Email icon illustration */}
      <View style={{ marginBottom: 24, alignItems: 'center' }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Mail color={colors.primary} size={40} />
        </View>
      </View>

      <View style={{ gap: 16 }}>
        {error ? <AuthBanner kind="error" message={error} /> : null}
        {success ? <AuthBanner kind="success" message={success} /> : null}

        <View>
          <Input
            label="Verification Code"
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            value={code}
            onChangeText={(val) => setCode(val.replace(/\D/g, ''))}
            editable={!isVerifying}
            style={{ textAlign: 'center', fontSize: 20, letterSpacing: 10 }}
          />
          <AppText muted style={{ marginTop: 4, fontSize: 12 }}>
            Enter the 6-digit code from your email
          </AppText>
        </View>

        <Button
          label="Verify Email"
          size="lg"
          fullWidth
          loading={isVerifying}
          disabled={code.length !== 6}
          onPress={handleSubmit}
        />

        <View style={{ alignItems: 'center', gap: 6 }}>
          <AppText muted style={{ fontSize: 13 }}>
            Didn&apos;t receive the code?
          </AppText>
          <Button
            label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            variant="ghost"
            size="sm"
            loading={isResending}
            disabled={cooldown > 0}
            onPress={handleResend}
          />
        </View>
      </View>

      <View style={{ marginTop: 24, alignItems: 'center' }}>
        <Pressable
          onPress={() => router.push('/(auth)/login')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft color={colors.textMuted} size={16} />
          <AppText muted style={{ fontSize: 13 }}>
            Back to login
          </AppText>
        </Pressable>
      </View>
    </AuthShell>
  );
}
