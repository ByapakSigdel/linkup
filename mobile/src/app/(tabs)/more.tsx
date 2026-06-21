import { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Pencil,
  Palette,
  Smile,
  Volume2,
  Clapperboard,
  Music,
  Trophy,
  Compass,
  Image as ImageIcon,
  Flame,
  User as UserIcon,
  Settings,
  Search,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';

import { Screen, AppText, Avatar, Card, Touchable, Row } from '@/components/ui';
import { AppBar } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { resolveMediaUrl } from '@/lib/env';

type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type Section = {
  label: string;
  items: Item[];
};

// Grouped like the web sidebar (apps/web/src/components/layout/sidebar.tsx),
// minus the items that already have their own bottom tabs (Home, Chat, Games,
// Circles). Everything reachable only from "More" lives here.
const SECTIONS: Section[] = [
  {
    label: 'Studio',
    items: [
      { href: '/scribble', label: 'Scribble', icon: Pencil },
      { href: '/paint', label: 'Paint', icon: Palette },
      { href: '/emojis', label: 'Emojis', icon: Smile },
      { href: '/soundboard', label: 'SoundBoard', icon: Volume2 },
    ],
  },
  {
    label: 'Side by side',
    items: [
      { href: '/watch', label: 'Watch Party', icon: Clapperboard },
      { href: '/music', label: 'Music', icon: Music },
    ],
  },
  {
    label: 'Your circle',
    items: [
      { href: '/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
      { href: '/circles/discover', label: 'Discover', icon: Compass },
    ],
  },
  {
    label: 'Everyday',
    items: [
      { href: '/gallery', label: 'Gallery', icon: ImageIcon },
      { href: '/streaks', label: 'Streaks', icon: Flame },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    label: 'You',
    items: [
      { href: '/profile', label: 'Profile', icon: UserIcon },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function MoreScreen() {
  const { colors, radius } = useTheme();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  const avatarUri = useMemo(
    () => resolveMediaUrl(user?.avatarUrl),
    [user?.avatarUrl],
  );

  return (
    <Screen scroll padded={false}>
      <View style={styles.headerWrap}>
        <AppBar title="More" />
      </View>

      {/* Couple / profile header */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.headerWrap}>
        <Touchable onPress={() => router.push('/profile')} accessibilityRole="button">
          <Card variant="elevated" style={styles.profileCard}>
            <Row gap={14}>
              <Avatar
                uri={avatarUri}
                name={user?.displayName ?? user?.username}
                size={56}
                online={user?.isOnline}
              />
              <View style={styles.profileText}>
                <AppText variant="subtitle" weight="bold" numberOfLines={1}>
                  {user?.displayName ?? 'You'}
                </AppText>
                {user?.username ? (
                  <AppText variant="caption" muted numberOfLines={1}>
                    @{user.username}
                  </AppText>
                ) : null}
                {couple?.isPaired ? (
                  <Row gap={6} style={{ marginTop: 4 }}>
                    <View
                      style={[styles.dot, { backgroundColor: colors.primary }]}
                    />
                    <AppText
                      variant="caption"
                      color={colors.primary}
                      weight="600"
                      numberOfLines={1}
                    >
                      {couple.coupleName || 'Linked up'}
                    </AppText>
                  </Row>
                ) : null}
              </View>
              <ChevronRight color={colors.textMuted} size={20} />
            </Row>
          </Card>
        </Touchable>
      </Animated.View>

      {/* Sections */}
      {SECTIONS.map((section, si) => (
        <Animated.View
          key={section.label}
          entering={FadeInDown.delay(80 + si * 60).duration(300)}
          style={styles.section}
        >
          <AppText
            variant="caption"
            weight="700"
            color={colors.textMuted}
            style={styles.sectionLabel}
          >
            {section.label.toUpperCase()}
          </AppText>
          <Card
            variant="bordered"
            padded={false}
            style={{ overflow: 'hidden', borderRadius: radius.card }}
          >
            {section.items.map((item, idx) => (
              <MenuRow
                key={item.href}
                item={item}
                isLast={idx === section.items.length - 1}
              />
            ))}
          </Card>
        </Animated.View>
      ))}

      <View style={{ height: 24 }} />
    </Screen>
  );
}

function MenuRow({ item, isLast }: { item: Item; isLast: boolean }) {
  const { colors } = useTheme();
  const Icon = item.icon;
  return (
    <Touchable
      onPress={() => router.push(item.href as never)}
      accessibilityRole="button"
      accessibilityLabel={item.label}
    >
      <View
        style={[
          styles.row,
          !isLast && {
            borderBottomColor: colors.border,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View
          style={[styles.iconBubble, { backgroundColor: colors.primaryLight }]}
        >
          <Icon color={colors.primary} size={19} />
        </View>
        <AppText variant="body" weight="600" style={styles.rowLabel}>
          {item.label}
        </AppText>
        <ChevronRight color={colors.textMuted} size={18} />
      </View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 16,
  },
  profileCard: {
    marginTop: 4,
    marginBottom: 8,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionLabel: {
    letterSpacing: 1.6,
    marginBottom: 8,
    marginLeft: 4,
  } as ViewStyle,
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
});
