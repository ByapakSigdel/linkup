import type { ThemeId } from './palettes';

/** Per-theme font family names (must match keys in fonts.ts / useFonts). */
export interface ThemeFonts {
  display: string; // headings / titles
  body: string; // regular body
  bodyMedium: string;
  bodySemibold: string;
  bodyBold: string;
  mono: string;
  script: string;
}

export interface ThemeShape {
  /** Card/button border width. */
  borderWidth: number;
  /** Hard offset shadow (no blur) — brutalist/arcade/loveletter "sticker" look. */
  hardShadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
  /** Neon glow on primary surfaces (arcade). */
  glow: boolean;
  glowColor: string;
  /** Constant card tilt in degrees (loveletter taped-note). */
  cardRotate: number;
  /** UPPERCASE button labels (brutalist/arcade). */
  uppercaseButtons: boolean;
}

export type BgPattern = 'stars' | 'paper' | 'dawn' | 'grid' | 'none' | 'scanlines';

export interface ThemeExtras {
  fonts: ThemeFonts;
  /** letterSpacing in px (RN units), approximating the web's em tracking. */
  headingTracking: number;
  bodyTracking: number;
  /** Multipliers so chunky pixel/condensed fonts read at the right size. */
  displayScale: number;
  bodyScale: number;
  shape: ThemeShape;
  pattern: BgPattern;
}

const HANKEN = {
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemibold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
};

export const extras: Record<ThemeId, ThemeExtras> = {
  default: {
    fonts: {
      display: 'Fraunces_500Medium',
      ...HANKEN,
      mono: 'SpaceMono_400Regular',
      script: 'Caveat_400Regular',
    },
    headingTracking: -0.3,
    bodyTracking: 0,
    displayScale: 1,
    bodyScale: 1,
    shape: {
      borderWidth: 1,
      hardShadow: false,
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
      glow: false,
      glowColor: '#c4a8e0',
      cardRotate: 0,
      uppercaseButtons: false,
    },
    pattern: 'stars',
  },

  loveletter: {
    fonts: {
      display: 'InstrumentSerif_400Regular',
      ...HANKEN,
      mono: 'SpaceMono_400Regular',
      script: 'Caveat_400Regular',
    },
    headingTracking: 0.1,
    bodyTracking: 0.1,
    displayScale: 1.08,
    bodyScale: 1,
    shape: {
      borderWidth: 1,
      hardShadow: true,
      shadowColor: 'rgba(0,0,0,0.45)',
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 3, height: 5 },
      elevation: 6,
      glow: false,
      glowColor: '#e0a56a',
      cardRotate: -0.6,
      uppercaseButtons: false,
    },
    pattern: 'paper',
  },

  daybreak: {
    fonts: {
      display: 'Fraunces_500Medium',
      ...HANKEN,
      mono: 'SpaceMono_400Regular',
      script: 'Caveat_400Regular',
    },
    headingTracking: -0.3,
    bodyTracking: 0,
    displayScale: 1,
    bodyScale: 1,
    shape: {
      borderWidth: 1,
      hardShadow: false,
      shadowColor: '#2a2420',
      shadowOpacity: 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 2,
      glow: false,
      glowColor: '#b07cd6',
      cardRotate: 0,
      uppercaseButtons: false,
    },
    pattern: 'dawn',
  },

  brutalist: {
    fonts: {
      display: 'ArchivoBlack_400Regular',
      body: 'SpaceGrotesk_400Regular',
      bodyMedium: 'SpaceGrotesk_500Medium',
      bodySemibold: 'SpaceGrotesk_500Medium',
      bodyBold: 'SpaceGrotesk_700Bold',
      mono: 'SpaceMono_400Regular',
      script: 'ArchivoBlack_400Regular',
    },
    headingTracking: -0.4,
    bodyTracking: 0,
    displayScale: 0.92,
    bodyScale: 1,
    shape: {
      borderWidth: 2.5,
      hardShadow: true,
      shadowColor: '#0a0a0a',
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 5, height: 5 },
      elevation: 0,
      glow: false,
      glowColor: '#2b4cff',
      cardRotate: 0,
      uppercaseButtons: true,
    },
    pattern: 'grid',
  },

  minimal: {
    fonts: {
      display: 'Inter_600SemiBold',
      body: 'Inter_400Regular',
      bodyMedium: 'Inter_500Medium',
      bodySemibold: 'Inter_600SemiBold',
      bodyBold: 'Inter_700Bold',
      mono: 'SpaceMono_400Regular',
      script: 'Inter_500Medium',
    },
    headingTracking: -0.5,
    bodyTracking: -0.1,
    displayScale: 1,
    bodyScale: 1,
    shape: {
      borderWidth: 1,
      hardShadow: false,
      shadowColor: '#000000',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
      glow: false,
      glowColor: '#161616',
      cardRotate: 0,
      uppercaseButtons: false,
    },
    pattern: 'none',
  },

  arcade: {
    fonts: {
      display: 'PressStart2P_400Regular',
      body: 'VT323_400Regular',
      bodyMedium: 'VT323_400Regular',
      bodySemibold: 'VT323_400Regular',
      bodyBold: 'VT323_400Regular',
      mono: 'VT323_400Regular',
      script: 'VT323_400Regular',
    },
    headingTracking: 0.4,
    bodyTracking: 0.6,
    displayScale: 0.5,
    bodyScale: 1.28,
    shape: {
      borderWidth: 2,
      hardShadow: true,
      shadowColor: 'rgba(0,0,0,0.6)',
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 4, height: 4 },
      elevation: 0,
      glow: true,
      glowColor: '#2bff88',
      cardRotate: 0,
      uppercaseButtons: true,
    },
    pattern: 'scanlines',
  },
};
