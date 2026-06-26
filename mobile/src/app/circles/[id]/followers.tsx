// Circles › Followers — owner-only list of couples that follow this circle
// (§1.6). Reached by tapping the "followers" stat on the profile header. Uses
// the shared ConnectionsList, which consumes GET /circles/me/followers.

import { View } from 'react-native';
import { Heart } from 'lucide-react-native';
import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import { useResponsive } from '@/hooks/use-responsive';
import { useAuthStore } from '@/stores/auth-store';
import { ConnectionsList } from '@/components/circles';

export default function CircleFollowersScreen() {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();
  const LIST_WIDTH = 680;
  const couple = useAuthStore((s) => s.couple);

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Followers" />
        <EmptyState
          icon={<Heart color={colors.primary} size={40} />}
          title="Link up with your partner first"
          subtitle="Pair with your partner to manage your circle's followers."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? LIST_WIDTH : undefined, alignSelf: 'center' }}>
        <ScreenHeader title="Followers" />
      </View>
      <ConnectionsList kind="followers" />
    </Screen>
  );
}
