import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';

/**
 * Apply a theme locally, then make it the couple's shared theme so it persists
 * for both partners: persist on the couple record and push to the partner live.
 */
export function selectTheme(themeId: string) {
  useThemeStore.getState().setTheme(themeId);

  const couple = useAuthStore.getState().couple;
  if (couple?.id) {
    // Persist on the couple (authoritative for both partners on next load).
    api
      .patch(`/couples/${couple.id}`, { sharedThemeId: themeId })
      .catch(() => {});
    // Keep our local copy in sync so a re-hydrate doesn't revert it.
    useAuthStore.getState().setCouple({ ...couple, sharedThemeId: themeId });
  }
  // Live push to the partner's open session.
  getSocket()?.emit('theme:change', { themeId });
}
