import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  type DimensionValue,
} from 'react-native';
import { router } from 'expo-router';
import { Gamepad2, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Screen, AppText } from '@/components/ui';
import { LinkupMark } from '@/components/brand-mark';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { useGamesStore } from '@/stores/games-store';
import {
  GAMES,
  CATEGORY_LABELS,
  getGame,
  type GameCategory,
} from '@/components/games/registry';

const ORDER: GameCategory[] = ['classic', 'couple', 'creative', 'luck'];

export default function GamesScreen() {
  const { colors, radius } = useTheme();
  const { isTablet, gridColumns, contentMaxWidth } = useResponsive();
  // Phones keep the original 2-up layout; tablets fan out to more columns.
  const columns = isTablet ? gridColumns : 2;
  // basis% leaves room for the 12px gaps between columns.
  const tileBasis = `${100 / columns - (columns > 2 ? 2 : 1.5)}%` as DimensionValue;
  const couple = useAuthStore((s) => s.couple);
  const partnerInGame = useGamesStore((s) => s.partnerInGame);
  const joinable = partnerInGame ? getGame(partnerInGame) : null;

  if (!couple?.isPaired) {
    return (
      <Screen>
        <View style={styles.notPaired}>
          <LinkupMark size={48} />
          <AppText variant="subtitle" weight="bold" center style={styles.notPairedTitle}>
            Games for two
          </AppText>
          <AppText variant="body" muted center style={styles.notPairedSub}>
            Link up with your partner to play together — head-to-head classics,
            couple games, and more.
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          contentMaxWidth
            ? { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
            : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: colors.primaryLight, borderRadius: radius.card },
            ]}
          >
            <Gamepad2 color={colors.primary} size={22} />
          </View>
          <View style={styles.headerText}>
            <AppText variant="title" weight="bold">
              Games
            </AppText>
            <AppText variant="caption" muted>
              Pick a game to play together
            </AppText>
          </View>
        </View>

        {joinable && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Pressable
              onPress={() => router.push(`/games/${joinable.key}`)}
              style={({ pressed }) => [
                styles.joinBanner,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.primaryLight,
                  borderRadius: radius.card,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.joinLeft}>
                <AppText style={styles.bannerEmoji}>{joinable.emoji}</AppText>
                <View style={styles.joinTextWrap}>
                  <AppText variant="caption" weight="bold" color={colors.primary}>
                    Your partner is in {joinable.name}
                  </AppText>
                  <AppText variant="caption" muted>
                    Tap to join them
                  </AppText>
                </View>
              </View>
              <ChevronRight color={colors.primary} size={20} />
            </Pressable>
          </Animated.View>
        )}

        {ORDER.map((cat, ci) => {
          const games = GAMES.filter((g) => g.category === cat);
          if (games.length === 0) return null;
          return (
            <Animated.View
              key={cat}
              entering={FadeInDown.delay(60 * ci).duration(300)}
              style={styles.section}
            >
              <AppText variant="caption" muted weight="700" style={styles.sectionLabel}>
                {CATEGORY_LABELS[cat].toUpperCase()}
              </AppText>
              <View style={styles.grid}>
                {games.map((g) => (
                  <Pressable
                    key={g.key}
                    onPress={() => router.push(`/games/${g.key}`)}
                    style={({ pressed }) => [
                      styles.tile,
                      { flexBasis: tileBasis },
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        borderRadius: radius.card,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    {partnerInGame === g.key && (
                      <View style={[styles.hereBadge, { backgroundColor: colors.success }]}>
                        <AppText
                          style={styles.hereText}
                          color={colors.textOnPrimary}
                        >
                          HERE
                        </AppText>
                      </View>
                    )}
                    <AppText style={styles.tileEmoji}>{g.emoji}</AppText>
                    <AppText variant="caption" weight="bold" center numberOfLines={1}>
                      {g.name}
                    </AppText>
                    <AppText variant="caption" muted center numberOfLines={2}>
                      {g.tagline}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 20,
  },
  notPaired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 4,
  },
  notPairedTitle: {
    marginTop: 16,
  },
  notPairedSub: {
    marginTop: 4,
    maxWidth: 320,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  joinBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    padding: 14,
  },
  joinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  joinTextWrap: {
    flex: 1,
  },
  bannerEmoji: {
    fontSize: 26,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    letterSpacing: 2,
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  tileEmoji: {
    fontSize: 34,
  },
  hereBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  hereText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
