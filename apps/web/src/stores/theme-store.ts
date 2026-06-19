import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { themeIds } from '@/styles/themes';

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
        // Coerce unknown/retired ids (incl. a couple's server-saved theme that
        // has since been removed) to default so no dead theme is ever applied.
        const id = themeIds.includes(themeId) ? themeId : 'default';
        set({ currentThemeId: id });
        applyThemeClass(id);
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ currentThemeId: state.currentThemeId }),
      // Re-apply the class once the persisted value is read back on reload.
      // Coerce any unknown/retired theme id (e.g. a removed theme) to default
      // so a stale persisted value can never leave a phantom selection.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const valid = themeIds.includes(state.currentThemeId)
          ? state.currentThemeId
          : 'default';
        if (valid !== state.currentThemeId) {
          useThemeStore.setState({ currentThemeId: valid });
        }
        applyThemeClass(valid);
      },
    },
  ),
);
