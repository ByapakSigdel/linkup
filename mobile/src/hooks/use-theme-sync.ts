import { useCallback, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';

interface UseThemeSyncReturn {
  /**
   * Apply a theme locally AND broadcast it to the partner so their app updates
   * too. Also patches the couple's `sharedThemeId` in the auth store.
   */
  broadcastTheme: (themeId: string) => void;
}

/**
 * Keeps the active theme in sync with the couple's `sharedThemeId`. When the
 * couple's shared theme changes (e.g. after hydrate or a partner broadcast that
 * updated the couple), apply it via the theme store. Exposes `broadcastTheme`
 * to push a local change out to the partner over the socket.
 */
export function useThemeSync(): UseThemeSyncReturn {
  const sharedThemeId = useAuthStore((s) => s.couple?.sharedThemeId);

  useEffect(() => {
    if (sharedThemeId) {
      useThemeStore.getState().setTheme(sharedThemeId);
    }
  }, [sharedThemeId]);

  const broadcastTheme = useCallback((themeId: string) => {
    useThemeStore.getState().setTheme(themeId);
    const couple = useAuthStore.getState().couple;
    if (couple) {
      useAuthStore.getState().setCouple({ ...couple, sharedThemeId: themeId });
    }
    getSocket()?.emit('theme:changed', { themeId });
  }, []);

  return { broadcastTheme };
}
