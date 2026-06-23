import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import { router } from 'expo-router';
import { Heart, Share2, Sparkles, Users } from 'lucide-react-native';

import { AppText, Button, Card, Input, Row, Screen } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useAuthStore } from '@/stores/auth-store';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/theme';
import { apiErrorMessage } from '@/lib/api';

export default function PairScreen() {
  const { colors } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const couple = useAuthStore((s) => s.couple);
  const createCouple = useAuthStore((s) => s.createCouple);
  const joinCouple = useAuthStore((s) => s.joinCouple);
  const refreshCouple = useAuthStore((s) => s.refreshCouple);

  const [mode, setMode] = useState<'choose' | 'join'>('choose');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The user created a couple and is waiting for their partner to enter the code.
  const hasPendingCouple = !!couple && !couple.isPaired;
  const pairingCode = couple?.pairingCode;

  // Already paired → nothing to do here.
  useEffect(() => {
    if (couple?.isPaired) router.replace('/dashboard');
  }, [couple?.isPaired]);

  // Poll for the partner to accept the code.
  useEffect(() => {
    if (!hasPendingCouple) return;
    const t = setInterval(() => {
      void refreshCouple();
    }, 5000);
    return () => clearInterval(t);
  }, [hasPendingCouple, refreshCouple]);

  const onCreate = useCallback(async () => {
    setError('');
    setBusy(true);
    try {
      await createCouple();
    } catch (e) {
      setError(apiErrorMessage(e, 'Could not create your couple space.'));
    } finally {
      setBusy(false);
    }
  }, [createCouple]);

  const onJoin = useCallback(async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 6) {
      setError('Enter the 8-character code your partner shared.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await joinCouple(c);
      router.replace('/dashboard');
    } catch (e) {
      setError(apiErrorMessage(e, "That code didn't work — double-check it and try again."));
    } finally {
      setBusy(false);
    }
  }, [code, joinCouple]);

  const onShare = useCallback(() => {
    if (!pairingCode) return;
    Share.share({
      message: `Link up with me on LinkUp 💫 — open the app, tap "Join with a code", and enter: ${pairingCode}`,
    }).catch(() => {});
  }, [pairingCode]);

  return (
    <Screen scroll maxWidth={contentMaxWidth}>
      <ScreenHeader title="Link up" />
      <View style={{ padding: 16, gap: 16 }}>
        {hasPendingCouple ? (
          <Card variant="elevated">
            <View style={{ alignItems: 'center', gap: 14 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles color={colors.primary} size={30} />
              </View>
              <AppText variant="title" center>
                Your pairing code
              </AppText>
              <AppText muted center style={{ maxWidth: 320 }}>
                Share this with your partner. The moment they enter it, you&apos;re linked.
              </AppText>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  marginTop: 4,
                }}
              >
                <AppText weight="700" style={{ fontSize: 30, letterSpacing: 8, textAlign: 'center', color: colors.text }}>
                  {pairingCode ?? '— — — —'}
                </AppText>
              </View>
              <Button
                label="Share code"
                leftIcon={<Share2 color={colors.textOnPrimary} size={16} />}
                onPress={onShare}
                fullWidth
                style={{ marginTop: 4 }}
              />
              <Row gap={8} style={{ marginTop: 4, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.textMuted} />
                <AppText muted style={{ fontSize: 13 }}>
                  Waiting for your partner to join…
                </AppText>
              </Row>
              <Pressable onPress={() => void refreshCouple()} hitSlop={8}>
                <AppText weight="500" style={{ color: colors.primary, fontSize: 13 }}>
                  Check now
                </AppText>
              </Pressable>
            </View>
          </Card>
        ) : mode === 'choose' ? (
          <>
            <Card variant="elevated">
              <View style={{ gap: 12 }}>
                <Row gap={10} style={{ alignItems: 'center' }}>
                  <Heart color={colors.primary} size={20} />
                  <AppText variant="subtitle">Create your couple space</AppText>
                </Row>
                <AppText muted>Generate a private code and invite your partner to join you.</AppText>
                <Button label="Create & get a code" onPress={onCreate} loading={busy} fullWidth />
              </View>
            </Card>
            <Card variant="elevated">
              <View style={{ gap: 12 }}>
                <Row gap={10} style={{ alignItems: 'center' }}>
                  <Users color={colors.primary} size={20} />
                  <AppText variant="subtitle">Have a code?</AppText>
                </Row>
                <AppText muted>Enter the pairing code your partner shared with you.</AppText>
                <Button variant="outline" label="Join with a code" onPress={() => { setMode('join'); setError(''); }} fullWidth />
              </View>
            </Card>
          </>
        ) : (
          <Card variant="elevated">
            <View style={{ gap: 14 }}>
              <AppText variant="subtitle">Enter pairing code</AppText>
              <Input
                label="Pairing code"
                placeholder="e.g. NUZWH8K2"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
                value={code}
                onChangeText={(v) => setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                style={{ letterSpacing: 4, fontSize: 18, textAlign: 'center' }}
              />
              <Button label="Link up" onPress={onJoin} loading={busy} disabled={code.length < 6} fullWidth />
              <Pressable onPress={() => { setMode('choose'); setError(''); setCode(''); }} style={{ alignSelf: 'center' }} hitSlop={8}>
                <AppText muted style={{ fontSize: 13 }}>
                  ‹ Back
                </AppText>
              </Pressable>
            </View>
          </Card>
        )}

        {error ? (
          <View
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: 'rgba(224,133,133,0.35)',
              backgroundColor: 'rgba(224,133,133,0.12)',
              padding: 12,
            }}
          >
            <AppText style={{ color: colors.error, fontSize: 13 }}>{error}</AppText>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
