import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Bell,
  Eye,
  Palette,
  Shield,
  LogOut,
  Type,
  Download,
  MessageCircle,
  Phone,
  Flame,
  Calendar,
  Users,
  Check,
  Trash2,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';

import {
  Screen,
  AppText,
  Muted,
  Button,
  Card,
  Input,
  Spinner,
  Divider,
  Row,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { GoogleReauthButton } from '@/components/google-reauth-button';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { themes, themeIds, type ThemeMeta } from '@/theme/themes';
import { useAuthStore, hasArchive, isActivelyPaired } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { getSocket } from '@/lib/socket';
import api, { apiErrorMessage } from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';

interface UserSettings {
  id: string;
  userId: string;
  themeId: string;
  pushNotifications: boolean;
  messageNotifications: boolean;
  callNotifications: boolean;
  streakReminders: boolean;
  anniversaryReminders: boolean;
  showOnlineStatus: boolean;
  showReadReceipts: boolean;
  showTypingIndicator: boolean;
  autoDownloadMedia: boolean;
  mediaQuality: string;
  fontSize: string;
  reduceMotion: boolean;
  highContrast: boolean;
}

const THEME_LIST: ThemeMeta[] = themeIds
  .map((id) => themes[id])
  .filter((t): t is ThemeMeta => Boolean(t));

const FONT_SIZES = ['small', 'medium', 'large'];
const MEDIA_QUALITIES = ['low', 'medium', 'high', 'original'];

/**
 * Apply a theme locally, persist it on the couple as the shared theme, and push
 * it live to the partner — mirrors the web `selectTheme` helper.
 */
function selectThemeShared(themeId: string) {
  useThemeStore.getState().setTheme(themeId);
  const couple = useAuthStore.getState().couple;
  if (couple?.id) {
    api.patch(`/couples/${couple.id}`, { sharedThemeId: themeId }).catch(() => {});
    useAuthStore.getState().setCouple({ ...couple, sharedThemeId: themeId });
  }
  // Emit the gateway's inbound event ('theme:change'); the server persists it
  // and relays 'theme:changed' to the partner — matches web's selectTheme.
  getSocket()?.emit('theme:change', { themeId });
}

export default function SettingsScreen() {
  const { colors, radius } = useTheme();
  const { contentMaxWidth, isWide, isTablet } = useResponsive();
  // Theme swatches: full-width rows on phones; 3-up on wide, 2-up on tablets.
  const themeColumns = isWide ? 3 : isTablet ? 2 : 1;
  const logout = useAuthStore((s) => s.logout);
  const currentThemeId = useThemeStore((s) => s.currentThemeId);
  const couple = useAuthStore((s) => s.couple);
  const setCouple = useAuthStore((s) => s.setCouple);
  const user = useAuthStore((s) => s.user);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const showMemories = useAuthStore((s) => hasArchive({ user: s.user, couple: s.couple }));
  // A paired delete offboards the partner compassionately; a survivor/solo
  // delete simply closes the account. We tailor the dialog copy accordingly.
  const paired = useAuthStore((s) => isActivelyPaired({ user: s.user, couple: s.couple }));

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [coupleName, setCoupleName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/users/me/settings');
      setSettings(res.data.data.settings);
    } catch {
      setSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setCoupleName(couple?.coupleName ?? '');
  }, [couple?.coupleName]);

  const saveCoupleName = useCallback(async () => {
    if (!couple) return;
    const trimmed = coupleName.trim();
    setSavingName(true);
    setNameSaved(false);
    try {
      const res = await api.patch(`/couples/${couple.id}`, {
        coupleName: trimmed,
      });
      const updated = res.data?.data?.couple ?? { ...couple, coupleName: trimmed };
      setCouple(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2200);
    } catch {
      // Leave the field as-is; the user can retry.
    } finally {
      setSavingName(false);
    }
  }, [couple, coupleName, setCouple]);

  const updateSetting = useCallback(
    async (key: keyof UserSettings, value: boolean | string) => {
      // Work even if the initial settings fetch failed (settings === null): the
      // backend upserts, so the toggle still saves instead of silently doing
      // nothing. Optimistically merge onto whatever we have (or an empty base).
      const prev = settings;
      setSettings((s) => ({ ...((s ?? {}) as UserSettings), [key]: value }));
      try {
        await api.patch('/users/me/settings', { [key]: value });
      } catch {
        setSettings(prev);
        useToastStore.getState().push({
          title: "Couldn't save setting",
          body: 'Check your connection and try again.',
          variant: 'info',
        });
      }
    },
    [settings],
  );

  const handleThemeChange = useCallback(
    async (themeId: string) => {
      selectThemeShared(themeId);
      if (settings) {
        setSettings({ ...settings, themeId });
        try {
          await api.patch('/users/me/settings', { themeId });
        } catch {
          // Theme is already applied locally.
        }
      }
    },
    [settings],
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  if (isLoading) {
    return (
      <Screen maxWidth={contentMaxWidth}>
        <ScreenHeader title="Settings" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  const nameUnchanged =
    coupleName.trim() === (couple?.coupleName ?? '').trim();

  return (
    <Screen padded={false} maxWidth={contentMaxWidth}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="Settings" subtitle="Customize your LinkUp experience" />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Couple */}
        {couple?.isPaired && (
          <Card>
            <View style={{ gap: 8 }}>
              <Row gap={8}>
                <Users color={colors.text} size={18} />
                <AppText variant="subtitle">Your couple</AppText>
              </Row>
              <AppText variant="label">Couple name</AppText>
              <Muted variant="caption">
                The shared name for the two of you — shown across LinkUp. Either
                partner can change it.
              </Muted>
              <Row gap={8} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={coupleName}
                    onChangeText={setCoupleName}
                    maxLength={100}
                    placeholder={`${user?.displayName ?? 'You'} & Partner`}
                  />
                </View>
                <Button
                  label={nameSaved ? 'Saved' : 'Save'}
                  loading={savingName}
                  disabled={savingName || nameUnchanged}
                  onPress={saveCoupleName}
                />
              </Row>
            </View>
          </Card>
        )}

        {/* Theme */}
        <Card>
          <View style={{ gap: 12 }}>
            <Row gap={8}>
              <Palette color={colors.text} size={18} />
              <AppText variant="subtitle">Theme</AppText>
            </Row>
            <View
              style={
                themeColumns > 1
                  ? { flexDirection: 'row', flexWrap: 'wrap', margin: -5 }
                  : { gap: 10 }
              }
            >
              {THEME_LIST.map((t) => (
                <View
                  key={t.id}
                  style={
                    themeColumns > 1
                      ? { width: `${100 / themeColumns}%`, padding: 5 }
                      : undefined
                  }
                >
                  <ThemeSwatch
                    theme={t}
                    active={currentThemeId === t.id}
                    onPress={() => handleThemeChange(t.id)}
                  />
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* Notifications */}
        <SettingsSection icon={<Bell color={colors.text} size={18} />} title="Notifications">
          <ToggleRow
            checked={settings?.pushNotifications ?? true}
            onChange={(v) => updateSetting('pushNotifications', v)}
            label="Push Notifications"
            description="Receive push notifications on your device"
            icon={<Bell color={colors.textMuted} size={18} />}
          />
          <ToggleRow
            checked={settings?.messageNotifications ?? true}
            onChange={(v) => updateSetting('messageNotifications', v)}
            label="Message Notifications"
            description="Get notified when you receive a message"
            icon={<MessageCircle color={colors.textMuted} size={18} />}
          />
          <ToggleRow
            checked={settings?.callNotifications ?? true}
            onChange={(v) => updateSetting('callNotifications', v)}
            label="Call Notifications"
            description="Get notified for incoming calls"
            icon={<Phone color={colors.textMuted} size={18} />}
          />
          <ToggleRow
            checked={settings?.streakReminders ?? true}
            onChange={(v) => updateSetting('streakReminders', v)}
            label="Streak Reminders"
            description="Remind me to keep my streak going"
            icon={<Flame color={colors.textMuted} size={18} />}
          />
          <ToggleRow
            checked={settings?.anniversaryReminders ?? true}
            onChange={(v) => updateSetting('anniversaryReminders', v)}
            label="Anniversary Reminders"
            description="Remind me of upcoming important dates"
            icon={<Calendar color={colors.textMuted} size={18} />}
            last
          />
        </SettingsSection>

        {/* Privacy */}
        <SettingsSection icon={<Shield color={colors.text} size={18} />} title="Privacy">
          <ToggleRow
            checked={settings?.showOnlineStatus ?? true}
            onChange={(v) => updateSetting('showOnlineStatus', v)}
            label="Show Online Status"
            description="Let your partner see when you're online"
            icon={<Eye color={colors.textMuted} size={18} />}
          />
          <ToggleRow
            checked={settings?.showReadReceipts ?? true}
            onChange={(v) => updateSetting('showReadReceipts', v)}
            label="Read Receipts"
            description="Show when you've read messages"
            icon={<Eye color={colors.textMuted} size={18} />}
          />
          <ToggleRow
            checked={settings?.showTypingIndicator ?? true}
            onChange={(v) => updateSetting('showTypingIndicator', v)}
            label="Typing Indicator"
            description="Show when you're typing a message"
            icon={<MessageCircle color={colors.textMuted} size={18} />}
            last
          />
        </SettingsSection>

        {/* Media & Data */}
        <SettingsSection icon={<Download color={colors.text} size={18} />} title="Media & Data">
          <ToggleRow
            checked={settings?.autoDownloadMedia ?? true}
            onChange={(v) => updateSetting('autoDownloadMedia', v)}
            label="Auto-Download Media"
            description="Automatically download shared photos and videos"
            icon={<Download color={colors.textMuted} size={18} />}
          />
          <SegmentRow
            label="Media Quality"
            description="Quality of uploaded media"
            options={MEDIA_QUALITIES}
            value={settings?.mediaQuality ?? 'high'}
            onChange={(v) => updateSetting('mediaQuality', v)}
            last
          />
        </SettingsSection>

        {/* Accessibility */}
        <SettingsSection icon={<Type color={colors.text} size={18} />} title="Accessibility">
          <SegmentRow
            label="Font Size"
            description="Adjust the text size"
            options={FONT_SIZES}
            value={settings?.fontSize ?? 'medium'}
            onChange={(v) => updateSetting('fontSize', v)}
          />
          <ToggleRow
            checked={settings?.reduceMotion ?? false}
            onChange={(v) => updateSetting('reduceMotion', v)}
            label="Reduce Motion"
            description="Minimize animations and transitions"
          />
          <ToggleRow
            checked={settings?.highContrast ?? false}
            onChange={(v) => updateSetting('highContrast', v)}
            label="High Contrast"
            description="Increase contrast for better readability"
            last
          />
        </SettingsSection>

        {/* Memories — shown once the survivor has gone solo (archived couple). */}
        {showMemories && (
          <Card padded={false}>
            <Pressable
              onPress={() => router.push('/memorial')}
              style={({ pressed }) => [styles.memoriesRow, { opacity: pressed ? 0.85 : 1 }]}
            >
              <View
                style={[
                  styles.memoriesIcon,
                  { backgroundColor: colors.primaryLight, borderRadius: radius.button },
                ]}
              >
                <Sparkles color={colors.primary} size={20} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <AppText variant="label">Memories</AppText>
                <Muted variant="caption">
                  Revisit your shared space — kept read-only, just as it was.
                </Muted>
              </View>
              <ChevronRight color={colors.textMuted} size={20} />
            </Pressable>
          </Card>
        )}

        {/* Account */}
        <Card>
          <View style={{ gap: 12 }}>
            <Row gap={8}>
              <LogOut color={colors.error} size={18} />
              <AppText variant="subtitle" color={colors.error}>
                Account
              </AppText>
            </Row>
            <Button
              label="Log Out"
              variant="destructive"
              fullWidth
              leftIcon={<LogOut color={colors.textOnPrimary} size={16} />}
              onPress={handleLogout}
            />
            <Pressable
              onPress={() => setShowDelete(true)}
              style={({ pressed }) => [
                styles.deleteRow,
                { borderColor: colors.error, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Trash2 color={colors.error} size={16} />
              <AppText variant="label" color={colors.error}>
                Delete account
              </AppText>
            </Pressable>
            <Muted variant="caption">
              Permanently closes your account. This can&apos;t be undone.
            </Muted>
          </View>
        </Card>

        <View style={{ height: 8 }} />
      </ScrollView>

      <DeleteAccountDialog
        visible={showDelete}
        paired={paired}
        onClose={() => setShowDelete(false)}
        deleteAccount={deleteAccount}
      />
    </Screen>
  );
}

/* ─── Delete-account confirm dialog (password) ─────────────────────────────── */
function DeleteAccountDialog({
  visible,
  paired,
  onClose,
  deleteAccount,
}: {
  visible: boolean;
  paired: boolean;
  onClose: () => void;
  deleteAccount: (password: string, googleIdToken?: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = useCallback(() => {
    setPassword('');
    setError('');
    setBusy(false);
    onClose();
  }, [onClose]);

  // Shared finalizer for both re-auth paths (password + Google).
  const finalize = useCallback(
    async (run: () => Promise<void>) => {
      setBusy(true);
      setError('');
      try {
        await run();
        router.replace('/goodbye');
      } catch (e) {
        setBusy(false);
        setError(apiErrorMessage(e, 'We could not verify that. Please try again.'));
      }
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    if (!password) {
      setError('Enter your password, or confirm with Google below.');
      return;
    }
    void finalize(() => deleteAccount(password));
  }, [password, deleteAccount, finalize]);

  // OAuth-only accounts (Google sign-in) can't supply a usable password — confirm
  // with a fresh Google ID token instead, forwarded as `googleIdToken`.
  const handleGoogleConfirm = useCallback(
    (idToken: string) => {
      if (busy) return;
      void finalize(() => deleteAccount('', idToken));
    },
    [busy, finalize, deleteAccount],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.dialogBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : close} />
        <Card variant="elevated" style={styles.dialogCard}>
          <View style={{ gap: 12 }}>
            <Row gap={8}>
              <Trash2 color={colors.error} size={18} />
              <AppText variant="subtitle" color={colors.error}>
                Delete account
              </AppText>
            </Row>
            <Muted variant="caption">
              {paired
                ? 'This permanently closes your account. Your partner will be met gently — your shared space becomes a read-only memorial for them. Enter your password to confirm.'
                : "This permanently closes your account and can't be undone. Enter your password to confirm."}
            </Muted>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
              error={error || undefined}
            />
            {/* Google sign-in path — the only way an OAuth-only account (no usable
                password, e.g. the dean/ayusha test accounts) can re-authenticate. */}
            <Row gap={10}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Muted variant="caption">or confirm with Google</Muted>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </Row>
            <GoogleReauthButton
              onCredential={handleGoogleConfirm}
              onError={(m) => setError(m)}
              disabled={busy}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Button label="Cancel" variant="ghost" fullWidth disabled={busy} onPress={close} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Delete"
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

/* ─── Section wrapper ──────────────────────────────────────────────────────── */
function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={{ gap: 4 }}>
        <Row gap={8} style={{ marginBottom: 4 }}>
          {icon}
          <AppText variant="subtitle">{title}</AppText>
        </Row>
        {children}
      </View>
    </Card>
  );
}

/* ─── Toggle row ───────────────────────────────────────────────────────────── */
function ToggleRow({
  checked,
  onChange,
  label,
  description,
  icon,
  last,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const offset = useSharedValue(checked ? 22 : 2);
  useEffect(() => {
    offset.value = withTiming(checked ? 22 : 2, { duration: 180 });
  }, [checked, offset]);
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          gap: 12,
        }}
      >
        <Row gap={12} style={{ flex: 1, minWidth: 0 }}>
          {icon}
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="label">{label}</AppText>
            {description ? (
              <Muted variant="caption">{description}</Muted>
            ) : null}
          </View>
        </Row>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked }}
          onPress={() => onChange(!checked)}
          style={{
            width: 46,
            height: 26,
            borderRadius: 13,
            backgroundColor: checked ? colors.primary : colors.surfaceHover,
            justifyContent: 'center',
          }}
        >
          <Animated.View
            style={[
              {
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.surface,
                shadowColor: colors.text,
                shadowOpacity: 0.2,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: 2,
              },
              knobStyle,
            ]}
          />
        </Pressable>
      </View>
      {!last ? <Divider /> : null}
    </View>
  );
}

/* ─── Segmented selector (replaces web <select>) ──────────────────────────── */
function SegmentRow({
  label,
  description,
  options,
  value,
  onChange,
  last,
}: {
  label: string;
  description?: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ paddingVertical: 12, gap: 8 }}>
        <View>
          <AppText variant="label">{label}</AppText>
          {description ? <Muted variant="caption">{description}</Muted> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <Pressable
                key={opt}
                onPress={() => onChange(opt)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? colors.primary : colors.surfaceHover,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <AppText
                  variant="caption"
                  weight="700"
                  color={active ? colors.textOnPrimary : colors.textMuted}
                  style={{ textTransform: 'capitalize' }}
                >
                  {opt}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {!last ? <Divider /> : null}
    </View>
  );
}

/* ─── Theme swatch card ────────────────────────────────────────────────────── */
function ThemeSwatch({
  theme,
  active,
  onPress,
}: {
  theme: ThemeMeta;
  active: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  const [bg, surface, primary, secondary, accent] = theme.swatch;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'stretch',
        padding: 10,
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primaryLight : 'transparent',
      }}
    >
      {/* mini preview */}
      <View
        style={{
          width: 80,
          height: 64,
          borderRadius: 10,
          overflow: 'hidden',
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: 'rgba(0,0,0,0.2)',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 10,
            left: 12,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: secondary,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 40,
            left: 50,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: accent,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 24,
            left: 32,
            width: 5,
            height: 5,
            backgroundColor: primary,
            transform: [{ rotate: '45deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            bottom: 8,
            height: 20,
            borderRadius: 4,
            backgroundColor: surface,
            justifyContent: 'center',
            paddingLeft: 6,
          }}
        >
          <AppText variant="caption" weight="700" color={primary}>
            Aa
          </AppText>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 2 }}>
        <Row gap={6}>
          <AppText
            variant="label"
            color={active ? colors.primary : colors.text}
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {theme.name}
          </AppText>
          {active ? <Check color={colors.primary} size={14} /> : null}
        </Row>
        <Muted variant="caption" numberOfLines={2} style={{ marginTop: 2 }}>
          {theme.description}
        </Muted>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  memoriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  memoriesIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
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
