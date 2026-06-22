import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';

import { ThemeProvider, useTheme, fontsToLoad } from '@/theme';
import { RealtimeProvider } from '@/components/realtime-provider';
import { Loading } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { connectSocket } from '@/lib/socket';

void SplashScreen.preventAutoHideAsync();

/**
 * Inner shell — rendered *inside* ThemeProvider so it can read theme tokens,
 * and gates the whole app on store rehydration (the splash) + wires up the
 * socket once we have a token.
 */
function RootShell() {
  const theme = useTheme();
  const hydrated = useAuthStore((s) => s.hydrated);
  const [fontsLoaded] = useFonts(fontsToLoad);
  const ready = hydrated && fontsLoaded;

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
    const { isAuthenticated, tokens } = useAuthStore.getState();
    if (isAuthenticated && tokens?.accessToken) {
      connectSocket(tokens.accessToken);
      void useAuthStore.getState().hydrate();
    }
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Loading />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.isLight ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RealtimeProvider>
            <RootShell />
          </RealtimeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
