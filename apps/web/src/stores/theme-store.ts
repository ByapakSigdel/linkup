import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

        // Apply theme class to the document element
        if (typeof document !== 'undefined') {
          const root = document.documentElement;

          // Remove all existing theme classes
          root.classList.forEach((cls) => {
            if (cls.startsWith('theme-')) {
              root.classList.remove(cls);
            }
          });

          // Apply the new theme class
          root.classList.add(`theme-${themeId}`);
        }
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({
        currentThemeId: state.currentThemeId,
      }),
    },
  ),
);
