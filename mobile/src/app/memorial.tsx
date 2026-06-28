import { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import {
  MessageCircle,
  Image as ImageIcon,
  Calendar,
  Sparkles,
  ChevronLeft,
} from 'lucide-react-native';

import { useTheme } from '@/theme';
import { AppText, Button, Card, Input, Spinner } from '@/components/ui';
import { useAuthStore, hasArchive } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import api, { apiErrorMessage } from '@/lib/api';
import ChatScreen from '@/app/(app)/chat';
import GalleryScreen from '@/app/(app)/gallery';
import { ConstellationOfUs } from '@/components/games/constellation';

type Tab = 'chat' | 'photos' | 'dates' | 'stars';

const TABS: { key: Tab; label: string; Icon: typeof MessageCircle }[] = [
  { key: 'chat', label: 'Messages', Icon: MessageCircle },
  { key: 'photos', label: 'Photos', Icon: ImageIcon },
  { key: 'dates', label: 'Dates', Icon: Calendar },
  { key: 'stars', label: 'Your sky', Icon: Sparkles },
];

/**
 * The Memorial: a compassionate read-only space for a relationship that has come
 * to rest. Opened either as a takeover (survivor of a freshly-ended couple who
 * hasn't yet chosen) or revisited later from "Memories" once she has gone solo
 * (in which case the couple is already loaded via archivedCoupleId in hydrate).
 *
 * The takeover offers two doors: look back on the shared memories (read-only),
 * and a gentle, de-emphasized fork — keep going solo, or wind down and leave.
 */
export default function MemorialScreen() {
  const theme = useTheme();
  const { colors, fonts } = theme;

  const archived = useAuthStore((s) => hasArchive({ user: s.user, couple: s.couple }));
  const couple = useAuthStore((s) => s.couple);
  const archiveAndGoSolo = useAuthStore((s) => s.archiveAndGoSolo);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  // Honor OS reduce-motion for the entrance animations.
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

  // 'intro' = the calm takeover; 'memorial' = the read-only tabbed archive.
  // When revisiting from Memories there's no decision to make, so jump straight
  // into the archive.
  const [view, setView] = useState<'intro' | 'memorial'>(archived ? 'memorial' : 'intro');
  const [tab, setTab] = useState<Tab>('chat');

  // Fork state.
  const [archiving, setArchiving] = useState(false);
  const [showLeave, setShowLeave] = useState(false);

  const handleGoSolo = useCallback(async () => {
    setArchiving(true);
    try {
      await archiveAndGoSolo();
      router.replace('/dashboard');
    } catch (e) {
      setArchiving(false);
      useToastStore.getState().push({
        title: "Couldn't continue",
        body: apiErrorMessage(e, 'Please try again in a moment.'),
        variant: 'info',
      });
    }
  }, [archiveAndGoSolo]);

  // ── Read-only memorial archive ──────────────────────────────────────────────
  if (view === 'memorial') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          {/* Header */}
          <View style={[styles.memHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => (archived ? router.replace('/dashboard') : setView('intro'))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <ChevronLeft color={colors.text} size={26} />
            </Pressable>
            <View style={styles.memHeaderCenter}>
              <AppText variant="subtitle" weight="bold" center numberOfLines={1}>
                Your memories
              </AppText>
              <AppText variant="caption" muted center numberOfLines={1}>
                Read-only — kept just as they were
              </AppText>
            </View>
            <View style={styles.backBtn} />
          </View>

          {/* Tab bar */}
          <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
            {TABS.map(({ key, label, Icon }) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[
                    styles.tab,
                    { borderBottomColor: active ? colors.primary : 'transparent' },
                  ]}
                >
                  <Icon color={active ? colors.primary : colors.textMuted} size={16} />
                  <AppText
                    variant="caption"
                    weight="600"
                    color={active ? colors.primary : colors.textMuted}
                  >
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Tab body — reuse the existing views in read-only mode. */}
          <View style={styles.flex}>
            {tab === 'chat' ? <ChatScreen readOnly /> : null}
            {tab === 'photos' ? <GalleryScreen readOnly /> : null}
            {tab === 'dates' ? <MemorialDates coupleId={couple?.id} /> : null}
            {tab === 'stars' ? (
              <View style={styles.flex}>
                <ConstellationOfUs readOnly />
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── The calm takeover ───────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.introContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={reduceMotion ? undefined : FadeIn.duration(1100)}>
            <Sparkles color={colors.primary} size={34} />
          </Animated.View>

          <Animated.Text
            entering={enter(150)}
            style={{
              fontFamily: fonts.display,
              fontSize: 28 * theme.displayScale,
              lineHeight: 38 * theme.displayScale,
              letterSpacing: theme.headingTracking,
              color: colors.text,
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            Your shared space with your partner has come to rest.
          </Animated.Text>

          <Animated.Text
            entering={enter(320)}
            style={{
              fontFamily: fonts.body,
              fontSize: 15 * theme.bodyScale,
              lineHeight: 23 * theme.bodyScale,
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: 16,
              maxWidth: 360,
            }}
          >
            Everything you made together is still here, just as it was. Take all
            the time you need — there's nothing you have to decide right now.
          </Animated.Text>

          {/* Primary affordance */}
          <Animated.View entering={enter(520)} style={styles.primaryAction}>
            <Button label="Look back on your memories" onPress={() => setView('memorial')} />
          </Animated.View>

          {/* The gentle, de-emphasized fork — never forced. */}
          <Animated.View entering={enter(700)} style={styles.fork}>
            <AppText variant="caption" muted center style={styles.forkLabel}>
              When you're ready
            </AppText>

            <Pressable
              onPress={handleGoSolo}
              disabled={archiving}
              style={({ pressed }) => [
                styles.forkRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: archiving ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.forkText}>
                <AppText variant="label">Keep going on your own</AppText>
                <AppText variant="caption" muted>
                  Continue solo. These memories stay, read-only, under Memories.
                </AppText>
              </View>
              {archiving ? <Spinner size="small" /> : null}
            </Pressable>

            <Pressable
              onPress={() => setShowLeave(true)}
              style={({ pressed }) => [
                styles.forkRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.forkText}>
                <AppText variant="label" color={colors.textMuted}>
                  Wind down &amp; leave
                </AppText>
                <AppText variant="caption" muted>
                  Close your account too. This can't be undone.
                </AppText>
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <LeaveDialog
        visible={showLeave}
        onClose={() => setShowLeave(false)}
        deleteAccount={deleteAccount}
      />
    </View>
  );
}

/* ─── Wind-down confirm dialog (password) ──────────────────────────────────── */
function LeaveDialog({
  visible,
  onClose,
  deleteAccount,
}: {
  visible: boolean;
  onClose: () => void;
  deleteAccount: (password: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setPassword('');
    setError('');
    setBusy(false);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!password) {
      setError('Enter your password to confirm.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
      router.replace('/goodbye');
    } catch (e) {
      setBusy(false);
      setError(apiErrorMessage(e, 'That password is incorrect.'));
    }
  }, [password, deleteAccount]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.dialogBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onClose} />
        <Card variant="elevated" style={styles.dialogCard}>
          <View style={{ gap: 12 }}>
            <AppText variant="subtitle">Wind down &amp; leave</AppText>
            <AppText variant="caption" muted>
              This closes your account for good. Once you're both gone, the
              memories you shared are gently cleared away. Enter your password to
              confirm.
            </AppText>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
              error={error || undefined}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  variant="ghost"
                  fullWidth
                  disabled={busy}
                  onPress={() => {
                    reset();
                    onClose();
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Leave"
                  variant="destructive"
                  fullWidth
                  loading={busy}
                  onPress={handleConfirm}
                />
              </View>
            </View>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

/* ─── Read-only important dates ────────────────────────────────────────────── */
interface MemorialDate {
  id: string;
  title: string;
  date: string;
}

function MemorialDates({ coupleId }: { coupleId?: string }) {
  const { colors, radius } = useTheme();
  const [dates, setDates] = useState<MemorialDate[] | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/dates')
      .then(({ data }) => {
        if (mounted) setDates(data.data?.dates ?? []);
      })
      .catch(() => {
        if (mounted) setDates([]);
      });
    return () => {
      mounted = false;
    };
  }, [coupleId]);

  if (dates === null) {
    return (
      <View style={styles.center}>
        <Spinner />
      </View>
    );
  }

  if (dates.length === 0) {
    return (
      <View style={styles.center}>
        <Calendar color={colors.textMuted} size={40} />
        <AppText variant="subtitle" center style={{ marginTop: 8 }}>
          No marked dates
        </AppText>
        <AppText muted center style={{ maxWidth: 300, marginTop: 4 }}>
          There are no important dates saved between you.
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {dates.map((d) => (
        <Card key={d.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={[
                styles.dateIcon,
                { backgroundColor: colors.primaryLight, borderRadius: radius.button },
              ]}
            >
              <Calendar color={colors.primary} size={20} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="label" numberOfLines={1}>
                {d.title}
              </AppText>
              <AppText variant="caption" muted>
                {new Date(d.date).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </AppText>
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  introContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  primaryAction: { marginTop: 36, alignSelf: 'stretch', maxWidth: 360, width: '100%' },
  fork: { marginTop: 36, alignSelf: 'stretch', maxWidth: 360, width: '100%', gap: 10 },
  forkLabel: { letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2 },
  forkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  forkText: { flex: 1, gap: 2 },
  memHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memHeaderCenter: { flex: 1, alignItems: 'center' },
  backBtn: { width: 44, height: 32, alignItems: 'center', justifyContent: 'center' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  dateIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialogCard: { width: '100%', maxWidth: 400 },
});
