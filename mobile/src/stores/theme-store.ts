import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/lib/storage';
import { themeIds } from '@/theme/themes';

interface ThemeState {
  currentThemeId: string;
  setTheme: (themeId: string) => void;
}

/**
 * Active theme id, shared by the couple. The ThemeProvider subscribes to this
 * and resolves the live palette. Unknown/retired ids coerce to 'default'.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      currentThemeId: 'default',
      setTheme: (themeId) =>
        set({ currentThemeId: themeIds.includes(themeId as never) ? themeId : 'default' }),
    }),
    {
      name: 'theme-storage',
      storage: zustandStorage,
      partialize: (state) => ({ currentThemeId: state.currentThemeId }),
    },
  ),
);
