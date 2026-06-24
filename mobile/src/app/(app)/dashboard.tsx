import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  Flame,
  MessageCircle,
  Video,
  Pencil,
  Camera,
  Clapperboard,
  Calendar,
  Clock,
  Sparkles,
  Heart,
  Image as ImageIcon,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Screen, AppText, Card, Button, Avatar, Skeleton, Row, Touchable } from '@/components/ui';
import { AppBar } from '@/components/top-bar';
import { LinkUpPanel } from '@/components/link-up-panel';
import { useTheme } from '@/theme';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useStreaksStore } from '@/stores/streaks-store';
import { useSocket } from '@/hooks/use-socket';
import { useCall } from '@/hooks/use-call';
import { useResponsive } from '@/hooks/use-responsive';

interface Partner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean | null;
}

interface UpcomingDate {
  id: string;
  title: string;
  date: string;
}

const quickActions = [
  { route: '/chat', label: 'Message', icon: MessageCircle },
  { route: '/scribble', label: 'Draw', icon: Pencil },
  { route: '/gallery', label: 'Photos', icon: Camera },
  { route: '/watch', label: 'Watch', icon: Clapperboard },
] as const;

function lastSeenText(iso?: string): string {
  if (!iso) return 'offline';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'last seen just now';
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  return `last seen ${Math.floor(h / 24)}d ago`;
}

export default function DashboardScreen() {
  const { colors, radius } = useTheme();
  const { contentMaxWidth } = useResponsive();

  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const { streak, fetchStreak } = useStreaksStore();

  // Live partner presence (kept fresh app-wide by the realtime provider).
  const isPartnerOnline = useChatStore((s) => s.isPartnerOnline);
  const partnerLastSeenAt = useChatStore((s) => s.partnerLastSeenAt);
  const { requestPresence } = useSocket();
  const { startCall } = useCall();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [nextDate, setNextDate] = useState<UpcomingDate | null>(null);
  const [seededOnline, setSeededOnline] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me/profile');
      const p: Partner | null = data.data?.partner ?? null;
      setPartner(p);
      setSeededOnline(p?.isOnline ?? null);
      try {
        const datesRes = await api.get('/dates', { params: { limit: 1 } });
        setNextDate(datesRes.data.data?.dates?.[0] ?? null);
      } catch {
        /* no dates */
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboard(), fetchStreak()]);
      setIsLoading(false);
    })();
  }, [fetchDashboard, fetchStreak]);

  // Pull-to-refresh: re-pull presence, partner, dates and streak on demand.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    requestPresence();
    await Promise.all([fetchDashboard(), fetchStreak()]);
    setRefreshing(false);
  }, [fetchDashboard, fetchStreak, requestPresence]);

  // Ask for the partner's current status now, then keep it fresh.
  useEffect(() => {
    requestPresence();
    const t = setInterval(requestPresence, 30000);
    return () => clearInterval(t);
  }, [requestPresence]);

  const daysTogether = couple?.createdAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(couple.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      )
    : 0;

  // Streak time-left.
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const msLeft = midnight.getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);
  const today = new Date().toISOString().split('T')[0];
  const sharedToday = streak?.lastPhotoDate === today;

  const daysUntil = (iso: string) => {
    const t = new Date(iso);
    t.setHours(0, 0, 0, 0);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.ceil((t.getTime() - d.getTime()) / 86_400_000);
  };

  const hour = now.getHours();
  const greeting =
    hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  // Prefer the live presence value; fall back to the freshly-fetched one.
  const online = isPartnerOnline || (partnerLastSeenAt === undefined && seededOnline === true);

  const hasStreak = !!streak && streak.currentStreak > 0;

  return (
    <Screen scroll padded={false} maxWidth={contentMaxWidth} onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.container}>
        <AppBar title="Home" />

        {isLoading ? (
          <DashboardSkeleton />
        ) : !couple?.isPaired ? (
          <NotPaired displayName={user?.displayName} />
        ) : (
          <View style={{ gap: 16 }}>
            {/* ── Partner presence — the centrepiece ── */}
            <Card variant="elevated">
              <AppText
                variant="caption"
                muted
                weight="700"
                style={{ letterSpacing: 2, textTransform: 'uppercase', fontSize: 11 }}
              >
                {greeting}, {user?.displayName}
              </AppText>

              {partner ? (
                <Row gap={16} style={{ marginTop: 16 }}>
                  <PresenceAvatar
                    uri={resolveMediaUrl(partner.avatarUrl)}
                    name={partner.displayName}
                    online={online}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AppText variant="title" numberOfLines={1}>
                      {partner.displayName}
                    </AppText>
                    <AppText
                      variant="label"
                      color={online ? colors.success : colors.textMuted}
                    >
                      {online ? 'Online now' : lastSeenText(partnerLastSeenAt)}
                    </AppText>
                    <Row gap={6} style={{ marginTop: 2, flexWrap: 'wrap' }}>
                      <Sparkles color={colors.primary} size={13} />
                      <AppText variant="caption" muted>
                        Together {daysTogether} days
                      </AppText>
                      {hasStreak && (
                        <>
                          <AppText variant="caption" muted>
                            ·
                          </AppText>
                          <Flame color={colors.accent} size={13} />
                          <AppText variant="caption" muted>
                            {streak!.currentStreak}-day streak
                          </AppText>
                        </>
                      )}
                    </Row>
                  </View>
                </Row>
              ) : (
                <AppText muted style={{ marginTop: 16 }}>
                  Invite your partner to get started.
                </AppText>
              )}

              {partner && (
                <Row gap={12} style={{ marginTop: 20 }}>
                  <Button
                    variant="primary"
                    onPress={() => router.push('/chat')}
                    style={{ flex: 1 }}
                    leftIcon={<MessageCircle color={colors.textOnPrimary} size={16} />}
                    label="Message"
                  />
                  <Button
                    variant="outline"
                    onPress={() =>
                      startCall('video', {
                        id: partner.id,
                        displayName: partner.displayName,
                        avatarUrl: resolveMediaUrl(partner.avatarUrl),
                      })
                    }
                    style={{ flex: 1 }}
                    leftIcon={<Video color={colors.text} size={16} />}
                    label="Video call"
                  />
                </Row>
              )}
            </Card>

            {/* ── Couple quick stats ── */}
            <Row gap={12}>
              <StatTile
                icon={<MessageCircle color={colors.primary} size={18} />}
                value={couple.messageCount ?? 0}
                label="Messages"
              />
              <StatTile
                icon={<ImageIcon color={colors.primary} size={18} />}
                value={couple.mediaCount ?? 0}
                label="Media"
              />
              <StatTile
                icon={<Heart color={colors.primary} size={18} />}
                value={daysTogether}
                label="Days"
              />
            </Row>

            {/* ── Today's streak — the one daily action ── */}
            <Card variant="bordered">
              <Row style={{ justifyContent: 'space-between' }} gap={12}>
                <Row gap={16} style={{ flex: 1 }}>
                  <View
                    style={[
                      styles.flameCircle,
                      { backgroundColor: hasStreak ? colors.accent : colors.surfaceHover },
                    ]}
                  >
                    <Flame color={hasStreak ? colors.textOnPrimary : colors.textMuted} size={26} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="subtitle">
                      {streak?.currentStreak ?? 0} day
                      {(streak?.currentStreak ?? 0) === 1 ? '' : 's'} streak
                    </AppText>
                    {sharedToday ? (
                      <Row gap={4} style={{ marginTop: 2 }}>
                        <Camera color={colors.success} size={13} />
                        <AppText variant="caption" color={colors.success}>
                          Photo shared today
                        </AppText>
                      </Row>
                    ) : (
                      <Row gap={4} style={{ marginTop: 2 }}>
                        <Clock color={colors.textMuted} size={13} />
                        <AppText variant="caption" muted>
                          {hoursLeft}h {minutesLeft}m left today
                        </AppText>
                      </Row>
                    )}
                  </View>
                </Row>
                {!sharedToday && (
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => router.push('/streaks')}
                    leftIcon={<Camera color={colors.textOnPrimary} size={15} />}
                    label="Share"
                  />
                )}
              </Row>
            </Card>

            {/* ── Next important date — only when there is one ── */}
            {nextDate && (
              <Touchable onPress={() => router.push('/profile')}>
                <Card variant="bordered">
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row gap={12} style={{ flex: 1 }}>
                      <View
                        style={[
                          styles.dateIcon,
                          { backgroundColor: colors.primaryLight, borderRadius: radius.button },
                        ]}
                      >
                        <Calendar color={colors.primary} size={20} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" numberOfLines={1}>
                          {nextDate.title}
                        </AppText>
                        <AppText variant="caption" muted>
                          {new Date(nextDate.date).toLocaleDateString(undefined, {
                            month: 'long',
                            day: 'numeric',
                          })}
                        </AppText>
                      </View>
                    </Row>
                    <View
                      style={[styles.datePill, { backgroundColor: colors.surfaceHover }]}
                    >
                      <AppText variant="caption" weight="600">
                        {(() => {
                          const d = daysUntil(nextDate.date);
                          return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`;
                        })()}
                      </AppText>
                    </View>
                  </Row>
                </Card>
              </Touchable>
            )}

            {/* ── Quick actions ── */}
            <Row gap={12}>
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Touchable
                    key={a.route}
                    onPress={() => router.push(a.route)}
                    style={{
                      ...styles.action,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.card,
                    }}
                  >
                    <Icon color={colors.primary} size={20} />
                    <AppText variant="caption" weight="600" style={{ marginTop: 8 }}>
                      {a.label}
                    </AppText>
                  </Touchable>
                );
              })}
            </Row>
          </View>
        )}
      </View>
    </Screen>
  );
}

/* ── Presence avatar with a pulsing ring when online ── */
function PresenceAvatar({
  uri,
  name,
  online,
}: {
  uri?: string;
  name: string;
  online: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (online) {
      scale.value = withRepeat(
        withSequence(withTiming(1.8, { duration: 1200 }), withTiming(1, { duration: 0 })),
        -1,
        false,
      );
      opacity.value = withRepeat(
        withSequence(withTiming(0, { duration: 1200 }), withTiming(0.6, { duration: 0 })),
        -1,
        false,
      );
    } else {
      scale.value = 1;
      opacity.value = 0;
    }
  }, [online, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 64, height: 64 }}>
      <Avatar uri={uri} name={name} size={64} />
      <View style={styles.dotWrap}>
        {online && (
          <Animated.View
            style={[styles.pulseRing, { backgroundColor: colors.success }, ringStyle]}
          />
        )}
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: online ? colors.success : colors.textMuted,
              borderColor: colors.surface,
            },
          ]}
        />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Card variant="bordered" style={{ flex: 1, alignItems: 'center', paddingVertical: 14 }}>
      {icon}
      <AppText variant="title" style={{ marginTop: 6 }}>
        {value}
      </AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </Card>
  );
}

function NotPaired({ displayName }: { displayName?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 14, marginTop: 24 }}>
      <View style={[styles.markCircle, { backgroundColor: colors.primaryLight }]}>
        <Heart color={colors.primary} size={32} />
      </View>
      <AppText variant="title" center>
        Welcome to LinkUp, {displayName}
      </AppText>
      <AppText muted center style={{ maxWidth: 340 }}>
        You&apos;re one step away. Create your private couple space or join with your partner&apos;s
        code to unlock chat, streaks, watch parties and more.
      </AppText>
      <View style={{ marginTop: 8, width: '100%', maxWidth: 420 }}>
        <LinkUpPanel />
      </View>
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <Card variant="elevated">
        <Skeleton width={140} height={12} />
        <Row gap={16} style={{ marginTop: 16 }}>
          <Skeleton width={64} height={64} radius={32} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={160} height={20} />
            <Skeleton width={100} height={14} />
            <Skeleton width={180} height={12} />
          </View>
        </Row>
        <Row gap={12} style={{ marginTop: 20 }}>
          <Skeleton height={46} radius={12} style={{ flex: 1 }} />
          <Skeleton height={46} radius={12} style={{ flex: 1 }} />
        </Row>
      </Card>
      <Row gap={12}>
        <Skeleton height={84} radius={14} style={{ flex: 1 }} />
        <Skeleton height={84} radius={14} style={{ flex: 1 }} />
        <Skeleton height={84} radius={14} style={{ flex: 1 }} />
      </Row>
      <Skeleton height={86} radius={14} />
      <Row gap={12}>
        <Skeleton height={76} radius={16} style={{ flex: 1 }} />
        <Skeleton height={76} radius={16} style={{ flex: 1 }} />
        <Skeleton height={76} radius={16} style={{ flex: 1 }} />
        <Skeleton height={76} radius={16} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 0 },
  flameCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    paddingVertical: 16,
  },
  dotWrap: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  markCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
