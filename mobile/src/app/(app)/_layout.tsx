import { Stack } from 'expo-router';
import { DrawerShell } from '@/components/drawer-shell';

/**
 * The main authenticated area. A custom slide-out sidebar (DrawerShell) wraps a
 * native Stack so every page is reachable — Expo SDK 56 removed expo-router's
 * react-navigation drawer, so we use our own reanimated drawer instead.
 */
export default function AppLayout() {
  return (
    <DrawerShell>
      <Stack screenOptions={{ headerShown: false }} />
    </DrawerShell>
  );
}
