// ============================================
// Theme Types
// ============================================

export interface LinkUpTheme {
  id: string;
  name: string;
  description: string;
  previewUrl?: string;

  // Layer 1: Design Tokens
  tokens: ThemeTokens;

  // Layer 2: Component Variants
  variants: ThemeVariants;

  // Layer 3: Decorative config
  decorations: ThemeDecorations;
}

export interface ThemeTokens {
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  effects: ThemeEffects;
}

export interface ThemeColors {
  // Core
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  accent: string;
  accentHover: string;

  // Backgrounds
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;

  // Text
  text: string;
  textMuted: string;
  textInverse: string;
  textOnPrimary: string;

  // Borders
  border: string;
  borderStrong: string;
  borderFocus: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Message bubbles
  messageSent: string;
  messageSentText: string;
  messageReceived: string;
  messageReceivedText: string;

  // Highlights
  highlightLove: string;
  highlightFunny: string;
  highlightImportant: string;
  highlightCelebration: string;
  highlightMilestone: string;

  // Gradients
  gradientPrimary: string;
  gradientSecondary: string;
  gradientAccent: string;
}

export interface ThemeTypography {
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  fontAccent?: string;
  headingWeight: number;
  bodyWeight: number;
  letterSpacingHeading: string;
  letterSpacingBody: string;
  headingStyle?: string;
}

export interface ThemeSpacing {
  unit: number;
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    full: string;
  };
}

export interface ThemeEffects {
  shadow: string;
  shadowMd: string;
  shadowLg: string;
  shadowHover: string;
  blur: string;
  glow?: string;
  transition: string;
}

// Layer 2: Variant selections per theme
export interface ThemeVariants {
  button: 'rounded' | 'pill' | 'square' | 'organic';
  card: 'flat' | 'elevated' | 'bordered' | 'sticker';
  input: 'underline' | 'outlined' | 'filled' | 'rounded';
  nav: 'sidebar' | 'top' | 'bottom';
  messageBubble: 'rounded' | 'sharp' | 'cloud' | 'organic';
  avatar: 'circle' | 'squircle' | 'hexagon' | 'organic';
  divider: 'line' | 'wave' | 'dots' | 'zigzag' | 'none';
  container: 'clean' | 'textured' | 'gradient' | 'pattern';
}

// Layer 3: Decorative element configuration
export interface ThemeDecorations {
  backgroundPattern?: string;
  hasSectionDividers: boolean;
  hasPageOrnaments: boolean;
  animationIntensity: 'none' | 'subtle' | 'moderate' | 'playful';
  cursorStyle?: string;
  scrollbarStyle: 'default' | 'thin' | 'hidden' | 'custom';
  emptyStateStyle: 'minimal' | 'illustrated' | 'animated';
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
  dateOfBirth?: string;
}

export interface AuthResponse {
  user: import('./user').User;
  tokens: AuthTokens;
  couple?: import('./couple').Couple;
}
