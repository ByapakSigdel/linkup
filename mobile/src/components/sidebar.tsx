import React from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { useUIStore } from '@/stores/ui-store';
import {
  Home,
  MessageCircle,
  Image as ImageIcon,
  Flame,
  Pencil,
  Palette,
  Smile,
  Volume2,
  Clapperboard,
  Music,
  Gamepad2,
  Trophy,
  Users,
  Compass,
  Settings,
  type LucideIcon,
} from 'lucide-react-native';

import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { AppText, Avatar, Touchable } from '@/components/ui';
import { LinkupMark, LinkupWordmark } from '@/components/brand-mark';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Everyday',
    items: [
      { href: '/dashboard', label: 'Home', icon: Home },
      { href: '/chat', label: 'Chat', icon: MessageCircle },
      { href: '/gallery', label: 'Gallery', icon: ImageIcon },
      { href: '/streaks', label: 'Streaks', icon: Flame },
    ],
  },
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
      { href: '/games', label: 'Games', icon: Gamepad2 },
      { href: '/watch', label: 'Watch Party', icon: Clapperboard },
      { href: '/music', label: 'Music', icon: Music },
    ],
  },
  {
    label: 'Your circle',
    items: [
      { href: '/hall-of-fame', label: 'Hall of Fame', icon: Trophy },
      { href: '/circles', label: 'Circles', icon: Users },
      { href: '/circles/discover', label: 'Discover', icon: Compass },
    ],
  },
];

function routeIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // "/circles" should NOT swallow "/circles/discover".
  if (href === '/circles') return pathname === '/circles';
  return pathname.startsWith(`${href}/`);
}

/**
 * Web-style slide-out drawer sidebar. Mirrors apps/web sidebar.tsx grouping and
 * styling, themed via useTheme. Rendered as the Drawer's custom drawerContent.
 */
export function Sidebar() {
  const theme = useTheme();
  const { colors, fonts, radius } = theme;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const unread = useChatStore((s) => s.unread);
  const closeDrawer = useUIStore((s) => s.closeDrawer);

  const go = (href: string) => {
    closeDrawer();
    router.push(href as never);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderRightColor: colors.border, borderRightWidth: StyleSheet.hairlineWidth }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        style={{ backgroundColor: colors.surface }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.header}>
          <LinkupMark size={30} />
          <LinkupWordmark size={16} />
        </View>

        {/* Couple status pill */}
        {couple?.isPaired ? (
          <View style={styles.pillRow}>
            <View
              style={[
                styles.pill,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <AppText
                variant="caption"
                numberOfLines={1}
                style={{ color: colors.primary, fontFamily: fonts.bodyMedium }}
              >
                {couple.coupleName || 'Linked up'}
              </AppText>
            </View>
          </View>
        ) : null}

        {/* Navigation */}
        <View style={styles.nav}>
          {NAV_SECTIONS.map((section) => (
            <View key={section.label} style={styles.section}>
              <AppText
                style={[
                  styles.sectionLabel,
                  {
                    color: colors.textMuted,
                    fontFamily: fonts.bodyMedium,
                  },
                ]}
              >
                {section.label.toUpperCase()}
              </AppText>
              <View style={styles.sectionItems}>
                {section.items.map((item) => {
                  const isActive = routeIsActive(pathname, item.href);
                  const Icon = item.icon;
                  const iconColor = isActive ? colors.primary : colors.textMuted;
                  const showBadge = item.href === '/chat' && unread > 0;

                  return (
                    <Touchable
                      key={item.href}
                      onPress={() => go(item.href)}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      style={StyleSheet.flatten([
                        styles.row,
                        { borderRadius: radius.button },
                        isActive ? { backgroundColor: colors.primaryLight } : null,
                      ])}
                    >
                      {isActive ? (
                        <View
                          style={[
                            styles.activeBar,
                            { backgroundColor: colors.primary },
                          ]}
                        />
                      ) : null}
                      <Icon
                        color={iconColor}
                        size={19}
                        strokeWidth={isActive ? 2.4 : 1.9}
                      />
                      <AppText
                        numberOfLines={1}
                        style={[
                          styles.rowLabel,
                          {
                            color: isActive ? colors.primary : colors.text,
                            fontFamily: isActive
                              ? fonts.bodySemibold
                              : fonts.bodyMedium,
                          },
                        ]}
                      >
                        {item.label}
                      </AppText>
                      {showBadge ? (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <AppText
                            style={[
                              styles.badgeText,
                              {
                                color: colors.textOnPrimary,
                                fontFamily: fonts.bodyBold,
                              },
                            ]}
                          >
                            {unread > 9 ? '9+' : String(unread)}
                          </AppText>
                        </View>
                      ) : null}
                    </Touchable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer: profile + settings */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Touchable
          onPress={() => go('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={StyleSheet.flatten([
            styles.profileRow,
            { borderRadius: radius.card },
          ])}
        >
          <Avatar
            uri={user?.avatarUrl}
            name={user?.displayName}
            size={36}
            online={user?.isOnline}
          />
          <View style={styles.profileMeta}>
            <AppText
              numberOfLines={1}
              style={{ color: colors.text, fontFamily: fonts.bodyMedium }}
            >
              {user?.displayName ?? 'You'}
            </AppText>
            {user?.username ? (
              <AppText variant="caption" muted numberOfLines={1}>
                @{user.username}
              </AppText>
            ) : null}
          </View>
        </Touchable>
        <Touchable
          onPress={() => go('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={styles.settingsBtn}
          hitSlop={8}
        >
          <Settings color={colors.textMuted} size={20} />
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 60,
    paddingHorizontal: 18,
  },
  pillRow: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  nav: {
    marginTop: 14,
    paddingHorizontal: 12,
    gap: 18,
  },
  section: {
    gap: 2,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 2,
    paddingHorizontal: 12,
    paddingBottom: 6,
    opacity: 0.7,
  },
  sectionItems: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -10,
    width: 3,
    height: 20,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  profileRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  profileMeta: {
    flex: 1,
    minWidth: 0,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
