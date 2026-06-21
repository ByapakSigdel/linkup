import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Loading } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';

export default function Index() {
  const theme = useTheme();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Wait for the persisted store before deciding where to send the user.
  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Loading />
      </View>
    );
  }

  return isAuthenticated ? (
    <Redirect href="/(tabs)/dashboard" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
