/**
 * The locked "Celestial" (midnight-constellation) palette + fonts for LinkUp's
 * front door (landing + auth). The web pins these regardless of the user's
 * selected theme via `.lk-celestial-scope` — the brand's first impression must
 * always read as the night sky. We mirror that here with fixed constants so the
 * landing/auth carousel ignores the active theme.
 */
export const CELESTIAL = {
  primary: '#c4a8e0',
  primaryHover: '#d3bce8',
  primaryLight: '#211d2e',
  secondary: '#d4a574',
  secondaryHover: '#e0b78c',
  accent: '#aec5d8',
  accentHover: '#c4d6e4',
  background: '#14171f',
  backgroundAlt: '#171b25',
  surface: '#1b202b',
  surfaceHover: '#232936',
  surfaceActive: '#2a3140',
  text: '#e8e4dc',
  textMuted: '#aab3c4',
  textOnPrimary: '#161019',
  border: '#2a313f',
  borderStrong: '#39414f',
  borderFocus: '#c4a8e0',
  success: '#7fd1ae',
  warning: '#d4a574',
  error: '#e08585',
  starlight: '#dcd8cf',
} as const;

/** Front-door fonts (already loaded in fonts.ts). */
export const CELESTIAL_FONTS = {
  serif: 'InstrumentSerif_400Regular', // editorial display
  mono: 'SpaceMono_400Regular', // eyebrows / coordinates
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemibold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold',
} as const;
