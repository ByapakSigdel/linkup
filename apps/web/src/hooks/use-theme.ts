import { useThemeStore } from '@/stores/theme-store';
import { themes, themeIds, getTheme, type ThemeMetadata } from '@/styles/themes';

export function useTheme() {
  const currentThemeId = useThemeStore((state) => state.currentThemeId);
  const setThemeId = useThemeStore((state) => state.setTheme);

  const currentTheme: ThemeMetadata = getTheme(currentThemeId);

  const availableThemes: ThemeMetadata[] = themeIds
    .map((id) => themes[id])
    .filter((t): t is ThemeMetadata => t !== undefined);

  const setTheme = (themeId: string) => {
    if (themes[themeId]) {
      setThemeId(themeId);
    }
  };

  return {
    currentTheme,
    currentThemeId,
    setTheme,
    availableThemes,
  };
}
