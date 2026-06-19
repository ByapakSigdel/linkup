'use client';

import { useEffect } from 'react';
import { useThemeStore, applyThemeClass } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentThemeId = useThemeStore((state) => state.currentThemeId);

  // Keep the <html> class in sync with the store for live theme changes.
  // Persistence + first-paint application are handled by the store's
  // onRehydrateStorage hook and the inline script in the root layout.
  useEffect(() => {
    applyThemeClass(currentThemeId);
  }, [currentThemeId]);

  return <>{children}</>;
}
