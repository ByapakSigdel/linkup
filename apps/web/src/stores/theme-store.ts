import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Swap the `theme-*` class on <html>. Pure DOM, no state write. */
export function applyThemeClass(themeId: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) root.classList.remove(cls);
  });
  root.classList.add(`theme-${themeId}`);
}

interface ThemeState {
  currentThemeId: string;
  setTheme: (themeId: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      currentThemeId: 'default',
      setTheme: (themeId: string) => {
        set({ currentThemeId: themeId });
        applyThemeClass(themeId);
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ currentThemeId: state.currentThemeId }),
      // Re-apply the class once the persisted value is read back on reload.
      onRehydrateStorage: () => (state) => {
        if (state?.currentThemeId) applyThemeClass(state.currentThemeId);
      },
    },
  ),
);
