import type { ThemeVariants, ThemeDecorations } from '@linkup/types';

export interface ThemeMetadata {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** [background, surface, primary, secondary, accent] for previews */
  swatch: [string, string, string, string, string];
  /** font-family stack used in the live preview chip */
  previewFont: string;
  variants: ThemeVariants;
  decorations: ThemeDecorations;
}

export const themes: Record<string, ThemeMetadata> = {
  default: {
    id: 'default',
    name: 'Celestial Cartography',
    tagline: 'A star-chart for two',
    description:
      'Deep night sky, hairline constellation lines, and an intimate serif. The signature LinkUp look.',
    swatch: ['#070a11', '#0d1119', '#c4a8e0', '#d4a574', '#a8bfd4'],
    previewFont: 'var(--font-fraunces), Georgia, serif',
    variants: {
      button: 'rounded',
      card: 'bordered',
      input: 'outlined',
      nav: 'sidebar',
      messageBubble: 'rounded',
      avatar: 'circle',
      divider: 'line',
      container: 'clean',
    },
    decorations: {
      backgroundPattern: 'stars',
      hasSectionDividers: true,
      hasPageOrnaments: true,
      animationIntensity: 'subtle',
      scrollbarStyle: 'thin',
      emptyStateStyle: 'minimal',
    },
  },

  loveletter: {
    id: 'loveletter',
    name: 'Midnight Love-Letter',
    tagline: 'Handwritten under the stars',
    description:
      'Warm ink on dark paper, taped notes, a romantic serif and typewriter accents. Cosy and personal.',
    swatch: ['#141009', '#1f1810', '#e0a56a', '#d98c9a', '#9db0a0'],
    previewFont: 'var(--font-instrument), Georgia, serif',
    variants: {
      button: 'square',
      card: 'sticker',
      input: 'outlined',
      nav: 'sidebar',
      messageBubble: 'sharp',
      avatar: 'circle',
      divider: 'dots',
      container: 'textured',
    },
    decorations: {
      backgroundPattern: 'grid',
      hasSectionDividers: true,
      hasPageOrnaments: true,
      animationIntensity: 'moderate',
      scrollbarStyle: 'thin',
      emptyStateStyle: 'illustrated',
    },
  },

  daybreak: {
    id: 'daybreak',
    name: 'Daybreak',
    tagline: 'For the daylight hours',
    description:
      'A pale dawn — warm cream, soft light, and the same constellation soul in a bright key.',
    swatch: ['#fbf7f1', '#ffffff', '#b07cd6', '#d99a5b', '#7c9cc4'],
    previewFont: 'var(--font-fraunces), Georgia, serif',
    variants: {
      button: 'rounded',
      card: 'bordered',
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

  brutalist: {
    id: 'brutalist',
    name: 'Neo-Brutalism',
    tagline: 'Loud, raw, unmissable',
    description:
      'Off-white paper, pure-black ink, thick borders and hard offset shadows. Clashing primaries and heavy grotesque type. Zero apologies.',
    swatch: ['#f4f2e7', '#ffffff', '#2b4cff', '#ff4d8d', '#ffd400'],
    previewFont: "var(--font-archivo), 'Arial Black', sans-serif",
    variants: {
      button: 'square',
      card: 'bordered',
      input: 'outlined',
      nav: 'sidebar',
      messageBubble: 'sharp',
      avatar: 'squircle',
      divider: 'line',
      container: 'textured',
    },
    decorations: {
      backgroundPattern: 'grid',
      hasSectionDividers: true,
      hasPageOrnaments: false,
      animationIntensity: 'subtle',
      scrollbarStyle: 'default',
      emptyStateStyle: 'minimal',
    },
  },

  minimal: {
    id: 'minimal',
    name: 'Minimal',
    tagline: "Everything you need, nothing you don't",
    description:
      'Pure white, ink black, one quiet grey. Hairline borders, no shadows, generous calm. Restraint as the whole statement.',
    swatch: ['#ffffff', '#fafafa', '#161616', '#6b6b6b', '#9a9a9a'],
    previewFont: 'var(--font-inter), system-ui, sans-serif',
    variants: {
      button: 'rounded',
      card: 'flat',
      input: 'underline',
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

  arcade: {
    id: 'arcade',
    name: 'Retro Arcade',
    tagline: 'Insert coin to continue',
    description:
      'An 8-bit CRT: deep arcade navy, neon coin-op colours, pixel type, zero radius, hard pixel shadows and scanlines. Press start.',
    swatch: ['#0b0b1a', '#1a1a36', '#ff5277', '#4de1ff', '#ffe14d'],
    previewFont: "var(--font-pixel), 'Courier New', monospace",
    variants: {
      button: 'square',
      card: 'elevated',
      input: 'outlined',
      nav: 'sidebar',
      messageBubble: 'sharp',
      avatar: 'squircle',
      divider: 'dots',
      container: 'pattern',
    },
    decorations: {
      backgroundPattern: 'scanlines',
      hasSectionDividers: true,
      hasPageOrnaments: true,
      animationIntensity: 'playful',
      scrollbarStyle: 'default',
      emptyStateStyle: 'illustrated',
    },
  },
};

export const themeIds = Object.keys(themes);

export const getTheme = (id: string): ThemeMetadata => {
  return themes[id] ?? themes['default']!;
};
