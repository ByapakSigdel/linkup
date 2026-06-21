import React, { createContext, useContext, useMemo } from 'react';
import { useThemeStore } from '@/stores/theme-store';
import { palettes, type Palette, type ThemeId } from './palettes';
import { themes, type ThemeMeta } from './themes';

export interface Theme {
  id: ThemeId;
  /** All color tokens — the RN equivalent of the web CSS variables. */
  colors: Palette;
  /** Shape language (corner radii in px). */
  radius: { card: number; button: number; input: number };
  /** Light background themes → dark status bar, and vice-versa. */
  isLight: boolean;
  meta: ThemeMeta;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentThemeId = useThemeStore((s) => s.currentThemeId);

  const value = useMemo<Theme>(() => {
    const id: ThemeId = palettes[currentThemeId as ThemeId]
      ? (currentThemeId as ThemeId)
      : 'default';
    const p = palettes[id];
    return {
      id,
      colors: p,
      radius: { card: p.cardRadius, button: p.btnRadius, input: p.inputRadius },
      isLight: p.isLight,
      meta: themes[id] ?? themes.default,
    };
  }, [currentThemeId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/** Shortcut for the color palette. */
export const useColors = (): Palette => useTheme().colors;
