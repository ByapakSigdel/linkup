import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Menu } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUIStore } from '@/stores/ui-store';
import { AppText, Touchable } from '@/components/ui';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Custom back handler. Defaults to router.back() when a chevron is shown. */
  onBack?: () => void;
  /** Set false to hide the back chevron entirely (defaults to shown). */
  showBack?: boolean;
  right?: ReactNode;
}

/**
 * Compact header row for pushed stack screens: optional back chevron, title +
 * optional subtitle, and an optional right-side node (actions).
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  right,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
      <View style={styles.side}>
        {showBack ? (
          <Touchable
            onPress={handleBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <ChevronLeft color={colors.text} size={26} />
          </Touchable>
        ) : null}
      </View>

      <View style={styles.center}>
        <AppText variant="subtitle" weight="bold" center numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted center numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

interface AppBarProps {
  title: string;
  right?: ReactNode;
}

/**
 * Large title bar for top-level drawer screens. Shows a hamburger that opens the
 * web-style sidebar drawer (no back chevron).
 */
export function AppBar({ title, right }: AppBarProps) {
  const { colors } = useTheme();
  const openDrawer = useUIStore((s) => s.openDrawer);

  return (
    <View style={styles.appBar}>
      <Touchable
        onPress={openDrawer}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        style={styles.menuBtn}
      >
        <Menu color={colors.text} size={26} />
      </Touchable>
      <AppText variant="display" weight="bold" numberOfLines={1} style={styles.appBarTitle}>
        {title}
      </AppText>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  side: {
    width: 48,
    justifyContent: 'center',
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingVertical: 8,
    minHeight: 56,
  },
  menuBtn: {
    width: 40,
    height: 40,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    flex: 1,
  },
});
