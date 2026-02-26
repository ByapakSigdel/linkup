'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentThemeId = useThemeStore((state) => state.currentThemeId);
  const setTheme = useThemeStore((state) => state.setTheme);

  // Apply persisted theme on mount
  useEffect(() => {
    setTheme(currentThemeId);
  }, [currentThemeId, setTheme]);

  return <>{children}</>;
}
