import { Stack, Redirect } from 'expo-router';
import { DrawerShell } from '@/components/drawer-shell';
import { useAuthStore, isMemorialPending } from '@/stores/auth-store';

/**
 * The main authenticated area. A custom slide-out sidebar (DrawerShell) wraps a
 * native Stack so every page is reachable — Expo SDK 56 removed expo-router's
 * react-navigation drawer, so we use our own reanimated drawer instead.
 */
export default function AppLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Subscribe reactively so a `couple:ended` refresh re-gates on next render.
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);

  // Re-gate reactively: if the session is cleared (e.g. the refresh token
  // expired and the interceptor logged us out), bounce to the welcome/login
  // flow instead of leaving the user on broken, perpetually-401'ing screens.
  if (hydrated && !isAuthenticated) {
    return <Redirect href="/welcome" />;
  }

  // Survivor of an ended relationship who hasn't yet chosen → memorial takeover.
  if (hydrated && isAuthenticated && isMemorialPending({ user, couple })) {
    return <Redirect href="/memorial" />;
  }

  return (
    <DrawerShell>
      <Stack screenOptions={{ headerShown: false }} />
    </DrawerShell>
  );
}
