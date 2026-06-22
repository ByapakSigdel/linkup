import { View, StyleSheet, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen, AppText, Button } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { getGame } from '@/components/games/registry';
import { useAuthStore } from '@/stores/auth-store';
import { useResponsive } from '@/hooks/use-responsive';

export default function GameRoute() {
  const params = useLocalSearchParams<{ key: string }>();
  const { isTablet } = useResponsive();
  const couple = useAuthStore((s) => s.couple);
  const game = getGame(String(params?.key ?? ''));

  if (!game) {
    return (
      <Screen>
        <ScreenHeader title="Game" />
        <View style={styles.fallback}>
          <AppText variant="body" muted center>
            That game doesn&apos;t exist.
          </AppText>
          <Button
            label="Back to games"
            variant="ghost"
            onPress={() => router.replace('/games')}
          />
        </View>
      </Screen>
    );
  }

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title={game.name} />
        <View style={styles.fallback}>
          <AppText variant="body" muted center>
            Link up with your partner to play together.
          </AppText>
        </View>
      </Screen>
    );
  }

  const Game = game.Component;

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={game.name}
        right={<AppText style={styles.emoji}>{game.emoji}</AppText>}
      />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Boards center at a comfortable max so they don't stretch on tablets. */}
        <View style={isTablet ? styles.gameWide : undefined}>
          <Game />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  body: {
    padding: 16,
    gap: 16,
  },
  gameWide: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  emoji: {
    fontSize: 20,
  },
});
