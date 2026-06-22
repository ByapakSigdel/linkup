import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Flame,
  Snowflake,
  RotateCcw,
  Camera,
  Trophy,
  Clock,
  TrendingUp,
  Star,
  Lock,
} from 'lucide-react-native';

import { Screen, Card, AppText, Button, Spinner, Divider } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useStreaksStore } from '@/stores/streaks-store';

const MILESTONE_LABELS: Record<number, string> = {
  7: 'One Week',
  30: 'One Month',
  100: 'Century',
  365: 'Full Year',
};

// RFC4122 v4 UUID (placeholder photo ID — see handleContribute).
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ─── Animated flame ──────────────────────────────────────────────────────── */
function AnimatedFlame({ active, color }: { active: boolean; color: string }) {
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.96, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      );
      rotate.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 700 }),
          withTiming(4, { duration: 700 }),
        ),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1);
      rotate.value = withTiming(0);
    }
  }, [active, scale, rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Flame color={color} size={56} fill={active ? color : 'transparent'} />
    </Animated.View>
  );
}

/* ─── Animated counting number ────────────────────────────────────────────── */
function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(value);
  const pop = useSharedValue(1);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) {
      setDisplay(value);
      return;
    }
    const from = prev.current;
    prev.current = value;
    const steps = Math.min(Math.abs(value - from), 30);
    const duration = 600;
    let i = 0;
    const tick = () => {
      i += 1;
      const t = i / steps;
      setDisplay(Math.round(from + (value - from) * t));
      if (i < steps) {
        setTimeout(tick, duration / steps);
      } else {
        setDisplay(value);
      }
    };
    if (steps > 0) tick();
    else setDisplay(value);

    pop.value = withSequence(
      withTiming(1.25, { duration: 180 }),
      withTiming(1, { duration: 220 }),
    );
  }, [value, pop]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={animStyle}>
      <AppText
        style={[styles.bigNumber, { color, fontVariant: ['tabular-nums'] }]}
      >
        {display}
      </AppText>
    </Animated.View>
  );
}

/* ─── Stat cell ───────────────────────────────────────────────────────────── */
function StatCell({
  icon,
  value,
  label,
  iconColor,
  wide,
}: {
  icon: (c: string) => React.ReactNode;
  value: number;
  label: string;
  iconColor: string;
  wide?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card
      variant="bordered"
      style={[styles.statCard, wide ? styles.statCardWide : null]}
    >
      <View style={styles.statInner}>
        {icon(iconColor)}
        <AppText
          style={[styles.statValue, { color: colors.text, fontVariant: ['tabular-nums'] }]}
        >
          {value}
        </AppText>
        <AppText variant="caption" muted center style={styles.statLabel}>
          {label}
        </AppText>
      </View>
    </Card>
  );
}

export default function StreaksScreen() {
  const { colors, radius } = useTheme();
  const { contentMaxWidth, isWide } = useResponsive();
  const {
    streak,
    history,
    isLoading,
    isContributing,
    error,
    fetchStreak,
    contributePhoto,
    freezeStreak,
    recoverStreak,
    fetchHistory,
  } = useStreaksStore();

  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  useEffect(() => {
    fetchStreak();
    fetchHistory();
  }, [fetchStreak, fetchHistory]);

  const handleContribute = useCallback(async () => {
    // In a real app, this would open the media picker and upload a photo first.
    // For now, we create a placeholder photo ID.
    const photoId = uuidv4();
    const result = await contributePhoto(photoId);
    if (result?.milestoneReached) {
      const label =
        MILESTONE_LABELS[result.milestoneReached] ?? `${result.milestoneReached} days`;
      setMilestoneToast(`Milestone reached: ${label}!`);
      setTimeout(() => setMilestoneToast(null), 4000);
    }
  }, [contributePhoto]);

  // Calculate hours remaining until midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const msRemaining = midnight.getTime() - now.getTime();
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  const today = new Date().toISOString().split('T')[0];
  const hasContributedToday = streak?.lastPhotoDate === today;

  if (isLoading && !streak) {
    return (
      <Screen maxWidth={contentMaxWidth}>
        <ScreenHeader title="Photo Streak" />
        <View style={styles.center}>
          <Spinner size="large" />
        </View>
      </Screen>
    );
  }

  const flameActive = !!streak && streak.currentStreak > 0;

  return (
    <Screen scroll padded={false} maxWidth={contentMaxWidth}>
      <View style={styles.headerWrap}>
        <ScreenHeader title="Photo Streak" />
      </View>

      <View style={styles.body}>
        {/* Milestone toast */}
        {milestoneToast && (
          <Card
            variant="elevated"
            style={[styles.toast, { backgroundColor: colors.accent }]}
          >
            <AppText style={styles.toastEmoji}>🏆</AppText>
            <AppText weight="700" color={colors.textOnPrimary} style={styles.toastText}>
              {milestoneToast}
            </AppText>
          </Card>
        )}

        {/* Header copy */}
        <View style={styles.intro}>
          <AppText
            variant="caption"
            weight="700"
            style={[styles.eyebrow, { color: colors.textMuted }]}
          >
            DAILY RITUAL
          </AppText>
          <AppText variant="title" weight="800">
            Photo Streak
          </AppText>
          <AppText muted>
            Share a photo with your partner every day to keep the streak alive
          </AppText>
        </View>

        {/* Current streak */}
        <Card variant="elevated" style={styles.streakCard}>
          <View style={styles.flameWrap}>
            <View
              style={[
                styles.flameCircle,
                {
                  backgroundColor: flameActive ? colors.accent : colors.surfaceHover,
                },
              ]}
            >
              <AnimatedFlame
                active={flameActive}
                color={flameActive ? colors.textOnPrimary : colors.textMuted}
              />
            </View>
            {streak?.status === 'frozen' && (
              <View style={[styles.frozenBadge, { backgroundColor: colors.info }]}>
                <Snowflake color={colors.textOnPrimary} size={18} />
              </View>
            )}
          </View>

          <AnimatedNumber value={streak?.currentStreak ?? 0} color={colors.text} />
          <AppText
            variant="caption"
            weight="700"
            style={[styles.eyebrow, { color: colors.textMuted, marginTop: 2 }]}
          >
            {(streak?.currentStreak ?? 0) === 1 ? 'DAY' : 'DAYS'} STREAK
          </AppText>

          {streak?.status === 'frozen' && (
            <View
              style={[
                styles.frozenPill,
                { backgroundColor: colors.info + '1A' },
              ]}
            >
              <Snowflake color={colors.info} size={12} />
              <AppText variant="caption" weight="600" color={colors.info}>
                Frozen
              </AppText>
            </View>
          )}
        </Card>

        {/* Action area */}
        <Card variant="bordered" style={styles.actionCard}>
          <View style={styles.actionRow}>
            {hasContributedToday ? (
              <View style={styles.statusLine}>
                <Camera color={colors.success} size={20} />
                <AppText weight="600" color={colors.success}>
                  Photo shared today
                </AppText>
              </View>
            ) : (
              <View style={styles.statusLine}>
                <Clock color={colors.textMuted} size={20} />
                <AppText muted>
                  <AppText muted style={{ fontVariant: ['tabular-nums'] }}>
                    {hoursRemaining}h {minutesRemaining}m
                  </AppText>{' '}
                  remaining
                </AppText>
              </View>
            )}

            <View style={styles.actionBtns}>
              {!hasContributedToday && (
                <Button
                  onPress={handleContribute}
                  disabled={isContributing}
                  loading={isContributing}
                  variant="primary"
                  size="md"
                  leftIcon={<Camera color={colors.textOnPrimary} size={16} />}
                  label="Share Photo"
                />
              )}

              {streak &&
                streak.currentStreak > 0 &&
                streak.status !== 'frozen' &&
                streak.freezesAvailable > 0 && (
                  <Button
                    onPress={freezeStreak}
                    variant="outline"
                    size="md"
                    leftIcon={<Snowflake color={colors.text} size={16} />}
                    label={`Freeze (${streak.freezesAvailable})`}
                  />
                )}

              {streak?.canRecover && (
                <Button
                  onPress={recoverStreak}
                  variant="secondary"
                  size="md"
                  leftIcon={<RotateCcw color={colors.text} size={16} />}
                  label="Recover"
                />
              )}
            </View>
          </View>

          {error && (
            <AppText variant="caption" color={colors.error} style={{ marginTop: 12 }}>
              {error}
            </AppText>
          )}
        </Card>

        {/* Stats grid — 2-up on phones/tablets, 4-up on wide screens. */}
        <View style={styles.statsGrid}>
          <StatCell
            wide={isWide}
            icon={(c) => <TrendingUp color={c} size={20} />}
            iconColor={colors.primary}
            value={streak?.longestStreak ?? 0}
            label="Longest Streak"
          />
          <StatCell
            wide={isWide}
            icon={(c) => <Camera color={c} size={20} />}
            iconColor={colors.secondary}
            value={streak?.totalPhotos ?? 0}
            label="Total Photos"
          />
          <StatCell
            wide={isWide}
            icon={(c) => <Star color={c} size={20} />}
            iconColor={colors.accent}
            value={streak?.totalPoints ?? 0}
            label="Total Points"
          />
          <StatCell
            wide={isWide}
            icon={(c) => <Snowflake color={c} size={20} />}
            iconColor={colors.info}
            value={streak?.freezesAvailable ?? 0}
            label="Freezes Left"
          />
        </View>

        {/* Milestones */}
        <Card variant="bordered">
          <AppText variant="subtitle" weight="700" style={styles.cardTitle}>
            Milestones
          </AppText>
          <View style={styles.milestoneWrap}>
            {Object.entries(MILESTONE_LABELS).map(([days, label]) => {
              const daysNum = parseInt(days, 10);
              const achieved = (streak?.longestStreak ?? 0) >= daysNum;
              return (
                <View
                  key={days}
                  style={[
                    styles.milestonePill,
                    {
                      backgroundColor: achieved ? colors.primary : colors.surfaceHover,
                    },
                  ]}
                >
                  {achieved ? (
                    <Trophy color={colors.textOnPrimary} size={14} />
                  ) : (
                    <Lock color={colors.textMuted} size={14} />
                  )}
                  <AppText
                    variant="caption"
                    weight="600"
                    color={achieved ? colors.textOnPrimary : colors.textMuted}
                  >
                    {label}
                  </AppText>
                  <AppText
                    variant="caption"
                    color={achieved ? colors.textOnPrimary : colors.textMuted}
                    style={{ opacity: 0.7, fontVariant: ['tabular-nums'] }}
                  >
                    ({days}d)
                  </AppText>
                </View>
              );
            })}
          </View>
        </Card>

        {/* History */}
        <Card variant="bordered">
          <AppText variant="subtitle" weight="700" style={styles.cardTitle}>
            Streak History
          </AppText>
          {history.length === 0 ? (
            <AppText muted center style={{ paddingVertical: 16 }}>
              No streak history yet. Start sharing photos!
            </AppText>
          ) : (
            <View>
              {history.map((entry, idx) => {
                const meta = EVENT_META[entry.eventType];
                const dotColor =
                  meta?.color === 'success'
                    ? colors.success
                    : meta?.color === 'accent'
                      ? colors.accent
                      : meta?.color === 'error'
                        ? colors.error
                        : meta?.color === 'info'
                          ? colors.info
                          : meta?.color === 'secondary'
                            ? colors.secondary
                            : colors.textMuted;
                return (
                  <View key={entry.id}>
                    <View style={styles.historyRow}>
                      <View style={styles.historyLeft}>
                        <View style={[styles.historyDot, { backgroundColor: dotColor }]}>
                          {meta?.icon(colors.textOnPrimary)}
                        </View>
                        <View>
                          <AppText variant="body" weight="600">
                            {meta?.title ?? entry.eventType}
                          </AppText>
                          <AppText variant="caption" muted>
                            Day{' '}
                            <AppText
                              variant="caption"
                              muted
                              style={{ fontVariant: ['tabular-nums'] }}
                            >
                              {entry.streakLength}
                            </AppText>
                          </AppText>
                        </View>
                      </View>
                      <AppText
                        variant="caption"
                        muted
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </AppText>
                    </View>
                    {idx < history.length - 1 && <Divider style={{ marginVertical: 12 }} />}
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

const EVENT_META: Record<
  string,
  { title: string; color: string; icon: (c: string) => React.ReactNode }
> = {
  photo_added: {
    title: 'Photo shared',
    color: 'success',
    icon: (c) => <Camera color={c} size={16} />,
  },
  milestone: {
    title: 'Milestone reached',
    color: 'accent',
    icon: (c) => <Trophy color={c} size={16} />,
  },
  streak_broken: {
    title: 'Streak broken',
    color: 'error',
    icon: (c) => <Flame color={c} size={16} />,
  },
  streak_frozen: {
    title: 'Streak frozen',
    color: 'info',
    icon: (c) => <Snowflake color={c} size={16} />,
  },
  streak_recovered: {
    title: 'Streak recovered',
    color: 'secondary',
    icon: (c) => <RotateCcw color={c} size={16} />,
  },
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerWrap: { paddingHorizontal: 16 },
  body: { padding: 16, gap: 16 },
  intro: { gap: 4 },
  eyebrow: { letterSpacing: 2, textTransform: 'uppercase', fontSize: 11 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  toastEmoji: { fontSize: 22 },
  toastText: { flex: 1 },
  streakCard: { alignItems: 'center', paddingVertical: 28 },
  flameWrap: { marginBottom: 16 },
  flameCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frozenBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigNumber: { fontSize: 52, fontWeight: '800', lineHeight: 58 },
  frozenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  actionCard: {},
  actionRow: { gap: 14 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flexGrow: 1, flexBasis: '46%' },
  statCardWide: { flexBasis: '22%' },
  statInner: { alignItems: 'center', gap: 4, paddingVertical: 6 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 },
  cardTitle: { marginBottom: 12 },
  milestoneWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
