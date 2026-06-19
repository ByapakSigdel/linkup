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

  nebula: {
    id: 'nebula',
    name: 'Dreamy Nebula',
    tagline: 'Lost in colour together',
    description:
      'Glowing nebula clouds, frosted glass, pillowy shapes and a bold display. Vivid and emotional.',
    swatch: ['#0a0613', '#160f28', '#c77dff', '#ff7eb6', '#7dd3fc'],
    previewFont: 'var(--font-unbounded), system-ui, sans-serif',
    variants: {
      button: 'pill',
      card: 'elevated',
      input: 'rounded',
      nav: 'sidebar',
      messageBubble: 'cloud',
      avatar: 'circle',
      divider: 'wave',
      container: 'gradient',
    },
    decorations: {
      backgroundPattern: 'stars',
      hasSectionDividers: true,
      hasPageOrnaments: true,
      animationIntensity: 'playful',
      scrollbarStyle: 'thin',
      emptyStateStyle: 'illustrated',
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
};

export const themeIds = Object.keys(themes);

export const getTheme = (id: string): ThemeMetadata => {
  return themes[id] ?? themes['default']!;
};
