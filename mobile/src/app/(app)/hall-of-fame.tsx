import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import {
  Trophy,
  Star,
  Sparkles,
  Heart,
  MessageCircle,
  Calendar,
  type LucideIcon,
} from 'lucide-react-native';

import {
  Screen,
  Card,
  AppText,
  Spinner,
  Row,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useResponsive } from '@/hooks/use-responsive';
import api from '@/lib/api';

type Tab = 'achievements' | 'highlights';

const TABS: { value: Tab; label: string; icon: LucideIcon }[] = [
  { value: 'achievements', label: 'Achievements', icon: Trophy },
  { value: 'highlights', label: 'Highlights', icon: Star },
];

export default function HallOfFameScreen() {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const couple = useAuthStore((s) => s.couple);
  const [activeTab, setActiveTab] = useState<Tab>('achievements');

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Hall of Fame" />
        <View style={styles.notPaired}>
          <Animated.View entering={FadeInDown.springify()}>
            <Trophy color={colors.primary} size={56} style={{ opacity: 0.9 }} />
          </Animated.View>
          <AppText variant="subtitle" weight="bold" center style={{ marginTop: 16 }}>
            Your Hall of Fame awaits
          </AppText>
          <AppText muted center style={{ marginTop: 4, maxWidth: 320 }}>
            Link up with your partner to start earning achievements and saving
            your favorite moments together.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="Hall of Fame" />
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <AppText
          variant="display"
          weight="bold"
          style={isTablet ? { fontSize: 34 } : undefined}
        >
          Hall of Fame
        </AppText>
        <AppText muted style={{ marginTop: 2 }}>
          Celebrate your milestones and the memories worth keeping
        </AppText>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <Pressable
              key={tab.value}
              onPress={() => setActiveTab(tab.value)}
              style={[
                styles.tab,
                {
                  borderBottomColor: isActive ? colors.primary : 'transparent',
                },
              ]}
            >
              <Icon
                color={isActive ? colors.primary : colors.textMuted}
                size={16}
              />
              <AppText
                variant="label"
                color={isActive ? colors.primary : colors.textMuted}
              >
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'achievements' ? <AchievementsTab /> : <HighlightsTab />}
    </Screen>
  );
}

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface Achievement {
  id: string;
  code: string;
  category: string;
  name: string;
  description: string;
  iconUrl: string; // an emoji
  points: number;
  rarity: Rarity;
  isUnlocked: boolean;
  unlockedAt: string | null;
  isShowcased: boolean;
  currentProgress: number;
  requiredProgress: number;
  percentage: number;
}

interface AchievementStats {
  totalAvailable: number;
  totalUnlocked: number;
  totalPoints: number;
}

const ACH_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'communication', label: 'Communication' },
  { value: 'memories', label: 'Memories' },
  { value: 'streaks', label: 'Streaks' },
  { value: 'time_based', label: 'Time' },
  { value: 'creative', label: 'Creative' },
  { value: 'social', label: 'Social' },
] as const;

/* ─── Achievements tab ────────────────────────────────────────────────────── */

const ACH_GRID_GAP = 12;
const CONTENT_PADDING = 16;

function AchievementsTab() {
  const { colors, radius } = useTheme();
  const push = useToastStore((s) => s.push);
  const { width, isTablet, isWide, contentMaxWidth } = useResponsive();

  // Achievement cards: 1 col phone → 2 on small tablets → 3-4 on wide.
  const columns = isWide ? (width >= 1100 ? 4 : 3) : isTablet ? 2 : 1;
  const innerWidth = Math.min(width, contentMaxWidth ?? width) - CONTENT_PADDING * 2;
  const cardWidth =
    columns > 1
      ? Math.floor((innerWidth - ACH_GRID_GAP * (columns - 1)) / columns)
      : undefined;

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats>({
    totalAvailable: 0,
    totalUnlocked: 0,
    totalPoints: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchAchievements = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/achievements');
      setAchievements(data.data?.achievements ?? []);
      setStats(
        data.data?.stats ?? {
          totalAvailable: 0,
          totalUnlocked: 0,
          totalPoints: 0,
        },
      );
    } catch {
      // Silently fail — empty state will render.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleToggleShowcase = useCallback(
    async (achievement: Achievement) => {
      const nextValue = !achievement.isShowcased;

      // Optimistic update.
      setAchievements((prev) =>
        prev.map((a) =>
          a.id === achievement.id ? { ...a, isShowcased: nextValue } : a,
        ),
      );

      try {
        const { data } = await api.post(
          `/achievements/${achievement.id}/showcase`,
        );
        const confirmed = data.data?.isShowcased ?? nextValue;
        setAchievements((prev) =>
          prev.map((a) =>
            a.id === achievement.id ? { ...a, isShowcased: confirmed } : a,
          ),
        );
        push({
          title: confirmed ? 'Added to showcase' : 'Removed from showcase',
          icon: achievement.iconUrl,
          variant: 'achievement',
        });
      } catch (err) {
        // Roll back on failure.
        setAchievements((prev) =>
          prev.map((a) =>
            a.id === achievement.id
              ? { ...a, isShowcased: achievement.isShowcased }
              : a,
          ),
        );
        const e = err as {
          response?: { data?: { error?: { message?: string } } };
        };
        push({
          title: 'Could not update showcase',
          body: e.response?.data?.error?.message,
          variant: 'default',
        });
      }
    },
    [push],
  );

  const filtered =
    activeCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeCategory);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" />
      </View>
    );
  }

  const completion =
    stats.totalAvailable > 0
      ? Math.round((stats.totalUnlocked / stats.totalAvailable) * 100)
      : 0;

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 40,
        gap: 16,
        width: '100%',
        maxWidth: contentMaxWidth ? contentMaxWidth + CONTENT_PADDING * 2 : undefined,
        alignSelf: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Stats header */}
      <Row gap={12}>
        <StatCard
          icon={<Trophy color={colors.primary} size={20} />}
          value={
            <AppText variant="title">
              {stats.totalUnlocked}
              <AppText muted variant="body">
                {' '}
                / {stats.totalAvailable}
              </AppText>
            </AppText>
          }
          label="Unlocked"
        />
        <StatCard
          icon={<Star color={colors.secondary} size={20} />}
          value={<AppText variant="title">{stats.totalPoints}</AppText>}
          label="Total points"
        />
      </Row>
      <StatCard
        wide
        icon={<Sparkles color={colors.accent} size={20} />}
        value={<AppText variant="title">{completion}%</AppText>}
        label="Completion"
      />

      {/* Category filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {ACH_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <Pressable
              key={cat.value}
              onPress={() => setActiveCategory(cat.value)}
              style={{
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: isActive ? colors.primary : colors.surfaceHover,
              }}
            >
              <AppText
                variant="label"
                color={isActive ? colors.textOnPrimary : colors.textMuted}
              >
                {cat.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Grid / empty state */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Trophy color={colors.textMuted} size={48} style={{ opacity: 0.6 }} />
          <AppText variant="subtitle" weight="bold" center style={{ marginTop: 12 }}>
            No achievements here yet
          </AppText>
          <AppText muted center style={{ marginTop: 4, maxWidth: 320 }}>
            {activeCategory === 'all'
              ? 'Keep spending time together to start unlocking achievements.'
              : 'No achievements in this category yet — try another filter.'}
          </AppText>
        </View>
      ) : (
        <View
          style={{
            flexDirection: columns > 1 ? 'row' : 'column',
            flexWrap: columns > 1 ? 'wrap' : 'nowrap',
            gap: ACH_GRID_GAP,
          }}
        >
          {filtered.map((achievement, i) => (
            <View
              key={achievement.id}
              style={cardWidth ? { width: cardWidth } : undefined}
            >
              <AchievementCard
                index={i}
                achievement={achievement}
                onToggleShowcase={handleToggleShowcase}
                colors={colors}
                radius={radius}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({
  icon,
  value,
  label,
  wide,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  wide?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <Card variant="bordered" style={wide ? undefined : { flex: 1 }}>
      <Row gap={12}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.button,
            backgroundColor: colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </View>
        <View>
          {value}
          <AppText variant="caption" muted>
            {label}
          </AppText>
        </View>
      </Row>
    </Card>
  );
}

/* ─── Achievement card ────────────────────────────────────────────────────── */

const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

function rarityColor(rarity: Rarity, colors: ReturnType<typeof useTheme>['colors']) {
  switch (rarity) {
    case 'uncommon':
      return colors.success;
    case 'rare':
      return colors.accent;
    case 'epic':
      return colors.primary;
    case 'legendary':
      return colors.secondary;
    default:
      return colors.textMuted;
  }
}

function AchievementCard({
  achievement,
  onToggleShowcase,
  index,
  colors,
  radius,
}: {
  achievement: Achievement;
  onToggleShowcase: (a: Achievement) => void;
  index: number;
  colors: ReturnType<typeof useTheme>['colors'];
  radius: ReturnType<typeof useTheme>['radius'];
}) {
  const isLocked = !achievement.isUnlocked;
  const rColor = rarityColor(achievement.rarity, colors);
  const pct = Math.min(
    100,
    Math.max(0, Math.round(achievement.percentage ?? 0)),
  );

  // Celebratory pop on freshly-unlocked cards.
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!isLocked) {
      scale.value = withDelay(
        index * 60,
        withSequence(
          withTiming(1.04, { duration: 220 }),
          withTiming(1, { duration: 220 }),
        ),
      );
    }
  }, [isLocked, index, scale]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()} style={popStyle}>
      <Card
        variant="bordered"
        style={{
          opacity: isLocked ? 0.6 : 1,
          borderColor: achievement.isShowcased
            ? colors.secondary
            : isLocked
              ? colors.border
              : rColor,
          borderWidth: achievement.isShowcased ? 2 : 1,
          gap: 12,
        }}
      >
        {/* Showcase toggle (unlocked only) */}
        {!isLocked && (
          <Pressable
            onPress={() => onToggleShowcase(achievement)}
            accessibilityRole="button"
            accessibilityLabel={
              achievement.isShowcased ? 'Remove from showcase' : 'Showcase'
            }
            style={{
              position: 'absolute',
              right: 8,
              top: 8,
              zIndex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: achievement.isShowcased
                ? colors.surfaceHover
                : 'transparent',
            }}
          >
            <Star
              color={colors.secondary}
              fill={achievement.isShowcased ? colors.secondary : 'transparent'}
              size={14}
            />
            <AppText
              variant="caption"
              weight="600"
              color={
                achievement.isShowcased ? colors.secondary : colors.textMuted
              }
            >
              {achievement.isShowcased ? 'Showcased' : 'Showcase'}
            </AppText>
          </Pressable>
        )}

        {/* Icon */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.card,
            backgroundColor: isLocked ? colors.surfaceHover : colors.primaryLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText style={{ fontSize: 32 }}>{achievement.iconUrl}</AppText>
        </View>

        {/* Name + description */}
        <View style={{ gap: 2 }}>
          <AppText variant="subtitle" weight="600">
            {achievement.name}
          </AppText>
          <AppText variant="body" muted>
            {achievement.description}
          </AppText>
        </View>

        {/* Meta row: rarity badge + points */}
        <Row style={{ justifyContent: 'space-between' }}>
          <View
            style={{
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
              backgroundColor: colors.surfaceHover,
            }}
          >
            <AppText variant="caption" weight="700" color={rColor}>
              {RARITY_LABEL[achievement.rarity] ?? 'Common'}
            </AppText>
          </View>
          <AppText variant="caption" muted weight="600">
            {achievement.points} pts
          </AppText>
        </Row>

        {/* Progress bar (locked only) */}
        {isLocked && (
          <View style={{ gap: 4 }}>
            <View
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: colors.surfaceHover,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                }}
              />
            </View>
            <AppText variant="caption" muted>
              {achievement.currentProgress}/{achievement.requiredProgress} · {pct}%
            </AppText>
          </View>
        )}
      </Card>
    </Animated.View>
  );
}

/* ─── Highlights tab ──────────────────────────────────────────────────────── */

interface HighlightedMessage {
  id: string;
  content: string;
  senderId: string;
  highlightColor: string | null;
  highlightNote: string | null;
  highlightCategory: string | null;
  sentAt: string;
  createdAt: string;
  isHighlighted?: boolean;
}

const HL_CATEGORIES = [
  { value: 'all', label: 'All', icon: Star },
  { value: 'love', label: 'Love', icon: Heart },
  { value: 'funny', label: 'Funny', icon: Sparkles },
  { value: 'milestone', label: 'Milestone', icon: Calendar },
  { value: 'important', label: 'Important', icon: MessageCircle },
] as const;

function highlightColor(
  category: string | null,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (category) {
    case 'love':
      return colors.highlightLove;
    case 'funny':
      return colors.highlightFunny;
    case 'milestone':
      return colors.highlightMilestone;
    case 'important':
      return colors.highlightImportant;
    default:
      return colors.primary;
  }
}

function HighlightsTab() {
  const { colors } = useTheme();
  const { contentMaxWidth } = useResponsive();
  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);
  const coupleId = couple?.id;

  const [highlights, setHighlights] = useState<HighlightedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchHighlights = useCallback(async () => {
    if (!coupleId) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/messages/couple/${coupleId}`, {
        params: { highlighted: true, limit: 100 },
      });
      const highlighted = (
        (data.data?.messages ?? []) as HighlightedMessage[]
      ).filter((m) => m.isHighlighted);
      setHighlights(highlighted);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const filtered =
    activeCategory === 'all'
      ? highlights
      : highlights.filter((h) => h.highlightCategory === activeCategory);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: 16,
        paddingBottom: 40,
        gap: 16,
        width: '100%',
        maxWidth: contentMaxWidth ? contentMaxWidth + 32 : undefined,
        alignSelf: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {HL_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.value;
          return (
            <Pressable
              key={cat.value}
              onPress={() => setActiveCategory(cat.value)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: isActive ? colors.primary : colors.surfaceHover,
              }}
            >
              <Icon
                color={isActive ? colors.textOnPrimary : colors.textMuted}
                size={16}
              />
              <AppText
                variant="label"
                color={isActive ? colors.textOnPrimary : colors.textMuted}
              >
                {cat.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Stats */}
      <Row gap={12} style={{ flexWrap: 'wrap' }}>
        {HL_CATEGORIES.filter((c) => c.value !== 'all').map((cat) => {
          const count = highlights.filter(
            (h) => h.highlightCategory === cat.value,
          ).length;
          const Icon = cat.icon;
          return (
            <Card
              key={cat.value}
              variant="bordered"
              style={styles.hlStat}
              padded={false}
            >
              <View style={{ alignItems: 'center', gap: 4, paddingVertical: 12 }}>
                <Icon color={colors.primary} size={20} />
                <AppText variant="title">{count}</AppText>
                <AppText variant="caption" muted>
                  {cat.label}
                </AppText>
              </View>
            </Card>
          );
        })}
      </Row>

      {/* Highlights list */}
      {filtered.length === 0 ? (
        <Card variant="bordered">
          <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
            <Star color={colors.textMuted} size={48} style={{ opacity: 0.4 }} />
            <AppText variant="subtitle" weight="bold" center>
              No highlights yet
            </AppText>
            <AppText muted center style={{ maxWidth: 320 }}>
              Highlight your favorite messages in chat to save them here. Tap
              the star icon on any message!
            </AppText>
          </View>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {filtered.map((msg, i) => {
            const bar = highlightColor(msg.highlightCategory, colors);
            const isMine = msg.senderId === user?.id;
            return (
              <Animated.View
                key={msg.id}
                entering={FadeInDown.delay(i * 50).springify()}
              >
                <Card
                  variant="flat"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: bar,
                    backgroundColor: colors.surface,
                  }}
                >
                  <View style={{ gap: 8 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <AppText variant="caption" muted weight="600">
                        {isMine ? 'You' : couple?.coupleName ?? 'Partner'}
                      </AppText>
                      <AppText variant="caption" muted>
                        {new Date(msg.sentAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </AppText>
                    </Row>
                    <AppText>{msg.content}</AppText>
                    {msg.highlightNote ? (
                      <AppText
                        variant="caption"
                        muted
                        style={{ fontStyle: 'italic' }}
                      >
                        &quot;{msg.highlightNote}&quot;
                      </AppText>
                    ) : null}
                    {msg.highlightCategory ? (
                      <View
                        style={{
                          alignSelf: 'flex-start',
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          backgroundColor: colors.surfaceHover,
                        }}
                      >
                        <AppText variant="caption" weight="600" color={bar}>
                          {msg.highlightCategory}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                </Card>
              </Animated.View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  notPaired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  hlStat: {
    flexBasis: '47%',
    flexGrow: 1,
  },
});
