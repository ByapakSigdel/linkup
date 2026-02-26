import type { ThemeVariants, ThemeDecorations } from '@linkup/types';

export interface ThemeMetadata {
  id: string;
  name: string;
  description: string;
  variants: ThemeVariants;
  decorations: ThemeDecorations;
}

export const themes: Record<string, ThemeMetadata> = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'A warm, clean, and modern look — the classic LinkUp experience.',
    variants: {
      button: 'rounded',
      card: 'elevated',
      input: 'outlined',
      nav: 'sidebar',
      messageBubble: 'rounded',
      avatar: 'circle',
      divider: 'line',
      container: 'clean',
    },
    decorations: {
      hasSectionDividers: false,
      hasPageOrnaments: false,
      animationIntensity: 'subtle',
      scrollbarStyle: 'thin',
      emptyStateStyle: 'minimal',
    },
  },

  dreamy: {
    id: 'dreamy',
    name: 'Dreamy',
    description: 'Whimsical and playful — soft gradients, pill shapes, and a lavender sky.',
    variants: {
      button: 'pill',
      card: 'sticker',
      input: 'rounded',
      nav: 'sidebar',
      messageBubble: 'cloud',
      avatar: 'squircle',
      divider: 'wave',
      container: 'gradient',
    },
    decorations: {
      backgroundPattern: 'stars',
      hasSectionDividers: true,
      hasPageOrnaments: true,
      animationIntensity: 'playful',
      scrollbarStyle: 'hidden',
      emptyStateStyle: 'illustrated',
    },
  },

  botanical: {
    id: 'botanical',
    name: 'Botanical',
    description: 'Earthy and bold — lush greens, warm roses, and organic shapes.',
    variants: {
      button: 'organic',
      card: 'bordered',
      input: 'filled',
      nav: 'sidebar',
      messageBubble: 'organic',
      avatar: 'organic',
      divider: 'zigzag',
      container: 'textured',
    },
    decorations: {
      backgroundPattern: 'leaves',
      hasSectionDividers: true,
      hasPageOrnaments: true,
      animationIntensity: 'moderate',
      scrollbarStyle: 'thin',
      emptyStateStyle: 'illustrated',
    },
  },

  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark and moody — neon accents cutting through deep navy.',
    variants: {
      button: 'square',
      card: 'flat',
      input: 'underline',
      nav: 'sidebar',
      messageBubble: 'sharp',
      avatar: 'hexagon',
      divider: 'dots',
      container: 'gradient',
    },
    decorations: {
      backgroundPattern: 'grid',
      hasSectionDividers: false,
      hasPageOrnaments: false,
      animationIntensity: 'subtle',
      scrollbarStyle: 'thin',
      emptyStateStyle: 'animated',
    },
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean and focused — monochrome elegance with a single accent.',
    variants: {
      button: 'rounded',
      card: 'flat',
      input: 'underline',
      nav: 'sidebar',
      messageBubble: 'rounded',
      avatar: 'circle',
      divider: 'none',
      container: 'clean',
    },
    decorations: {
      hasSectionDividers: false,
      hasPageOrnaments: false,
      animationIntensity: 'none',
      scrollbarStyle: 'default',
      emptyStateStyle: 'minimal',
    },
  },
};

export const themeIds = Object.keys(themes) as string[];

export const getTheme = (id: string): ThemeMetadata => {
  return (themes[id] ?? themes['default'])!;
};
