// Circles › Following — owner-only list of couples this circle follows (§1.6).
// Reached by tapping the "following" stat on the profile header. Uses the shared
// ConnectionsList, which consumes GET /circles/me/following.

import { View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { ConnectionsList } from '@/components/circles';

export default function CircleFollowingScreen() {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const LIST_WIDTH = 680;
  const couple = useAuthStore((s) => s.couple);

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Following" />
        <EmptyState
          icon={<Heart color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Pair with your partner to manage who your circle follows."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? LIST_WIDTH : undefined, alignSelf: 'center' }}>
        <ScreenHeader title="Following" />
      </View>
      <ConnectionsList kind="following" />
    </Screen>
  );
}
