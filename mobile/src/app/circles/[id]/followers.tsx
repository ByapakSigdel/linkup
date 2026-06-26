// Circles › Followers — followers of THIS circle (the [id] in the route), not
// the viewer's own (§1.6). Reached by tapping the "followers" stat on the
// profile header. Uses the shared ConnectionsList scoped to the circle via the
// public GET /circles/:id/followers (visibility enforced server-side).

import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useResponsive } from '@/hooks/use-responsive';
import { ConnectionsList } from '@/components/circles';

export default function CircleFollowersScreen() {
  const { isTablet } = useResponsive();
  const LIST_WIDTH = 680;
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, width: '100%', maxWidth: isTablet ? LIST_WIDTH : undefined, alignSelf: 'center' }}>
        <ScreenHeader title="Followers" />
      </View>
      <ConnectionsList kind="followers" circleIdOrHandle={id} />
    </Screen>
  );
}
