export type ThemeId =
  | 'default'
  | 'loveletter'
  | 'daybreak'
  | 'brutalist'
  | 'minimal'
  | 'arcade';

export interface Palette {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  accent: string;
  accentHover: string;
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;
  text: string;
  textMuted: string;
  textInverse: string;
  textOnPrimary: string;
  border: string;
  borderStrong: string;
  borderFocus: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  messageSent: string;
  messageSentText: string;
  messageReceived: string;
  messageReceivedText: string;
  highlightLove: string;
  highlightFunny: string;
  highlightImportant: string;
  highlightCelebration: string;
  highlightMilestone: string;
  /** shape language */
  cardRadius: number; // from --lk-card-radius (px number, no 'px')
  btnRadius: number; // from --lk-btn-radius
  inputRadius: number; // from --lk-input-radius
  /** true for daybreak/brutalist/minimal (light backgrounds), false otherwise — used for StatusBar style */
  isLight: boolean;
}

export const palettes: Record<ThemeId, Palette> = {
  // Celestial Cartography — the default identity (:root, .theme-default)
  default: {
    primary: '#c4a8e0',
    primaryHover: '#d8c2ef',
    primaryLight: '#181527',
    secondary: '#d4a574',
    secondaryHover: '#e2b888',
    accent: '#a8bfd4',
    accentHover: '#c0d3e3',
    background: '#070a11',
    backgroundAlt: '#0a0e17',
    surface: '#0d1119',
    surfaceHover: '#131a26',
    surfaceActive: '#1a2233',
    text: '#ece8e0',
    textMuted: '#828ca3',
    textInverse: '#070a11',
    textOnPrimary: '#0b0b14',
    border: '#1a2130',
    borderStrong: '#2a3445',
    borderFocus: '#c4a8e0',
    success: '#7fd1ae',
    warning: '#d4a574',
    error: '#e08585',
    info: '#a8bfd4',
    messageSent: '#c4a8e0',
    messageSentText: '#0b0b14',
    messageReceived: '#131a26',
    messageReceivedText: '#ece8e0',
    highlightLove: '#c4a8e0',
    highlightFunny: '#d4a574',
    highlightImportant: '#e08585',
    highlightCelebration: '#a8bfd4',
    highlightMilestone: '#7fd1ae',
    cardRadius: 14,
    btnRadius: 11,
    inputRadius: 11,
    isLight: false,
  },

  // Midnight Love-Letter (.theme-loveletter)
  loveletter: {
    primary: '#e0a56a',
    primaryHover: '#ecb87f',
    primaryLight: '#241c12',
    secondary: '#d98c9a',
    secondaryHover: '#e6a3af',
    accent: '#9db0a0',
    accentHover: '#b3c4b6',
    background: '#141009',
    backgroundAlt: '#181308',
    surface: '#1f1810',
    surfaceHover: '#271f15',
    surfaceActive: '#30271a',
    text: '#efe4ce',
    textMuted: '#a8967a',
    textInverse: '#141009',
    textOnPrimary: '#2a1c0c',
    border: '#382c1d',
    borderStrong: '#4d3d29',
    borderFocus: '#e0a56a',
    success: '#a3b58c',
    warning: '#e0a56a',
    error: '#d98c8c',
    info: '#9db0a0',
    messageSent: '#e0a56a',
    messageSentText: '#2a1c0c',
    messageReceived: '#271f15',
    messageReceivedText: '#efe4ce',
    highlightLove: '#d98c9a',
    highlightFunny: '#e0a56a',
    highlightImportant: '#d98c8c',
    highlightCelebration: '#c9a9d4',
    highlightMilestone: '#a3b58c',
    cardRadius: 5,
    btnRadius: 6,
    inputRadius: 6,
    isLight: false,
  },

  // Daybreak — light theme (.theme-daybreak)
  daybreak: {
    primary: '#b07cd6',
    primaryHover: '#9a64c4',
    primaryLight: '#f3ecfa',
    secondary: '#d99a5b',
    secondaryHover: '#c4863f',
    accent: '#7c9cc4',
    accentHover: '#6688b5',
    background: '#fbf7f1',
    backgroundAlt: '#f4eee5',
    surface: '#ffffff',
    surfaceHover: '#faf6ef',
    surfaceActive: '#f2ebe0',
    text: '#2a2420',
    textMuted: '#8a7f72',
    textInverse: '#fbf7f1',
    textOnPrimary: '#ffffff',
    border: '#ece3d6',
    borderStrong: '#ddd0bd',
    borderFocus: '#b07cd6',
    success: '#4faa84',
    warning: '#d99a5b',
    error: '#d56b6b',
    info: '#7c9cc4',
    messageSent: '#b07cd6',
    messageSentText: '#ffffff',
    messageReceived: '#f2ebe0',
    messageReceivedText: '#2a2420',
    highlightLove: '#d98aa8',
    highlightFunny: '#e0b15b',
    highlightImportant: '#d56b6b',
    highlightCelebration: '#b07cd6',
    highlightMilestone: '#4faa84',
    cardRadius: 16,
    btnRadius: 12,
    inputRadius: 12,
    isLight: true,
  },

  // Neo-Brutalism (.theme-brutalist)
  brutalist: {
    primary: '#2b4cff',
    primaryHover: '#1a39e6',
    primaryLight: '#dfe4ff',
    secondary: '#ff4d8d',
    secondaryHover: '#ff2d77',
    accent: '#ffd400',
    accentHover: '#f2c800',
    background: '#f4f2e7',
    backgroundAlt: '#eceadb',
    surface: '#ffffff',
    surfaceHover: '#f2f0e3',
    surfaceActive: '#e8e5d3',
    text: '#0a0a0a',
    textMuted: '#57534a',
    textInverse: '#ffffff',
    textOnPrimary: '#ffffff',
    border: '#0a0a0a',
    borderStrong: '#000000',
    borderFocus: '#2b4cff',
    success: '#00a63e',
    warning: '#f59e0b',
    error: '#ff2d2d',
    info: '#2b4cff',
    messageSent: '#2b4cff',
    messageSentText: '#ffffff',
    messageReceived: '#ffffff',
    messageReceivedText: '#0a0a0a',
    highlightLove: '#ff4d8d',
    highlightFunny: '#ffd400',
    highlightImportant: '#ff2d2d',
    highlightCelebration: '#2b4cff',
    highlightMilestone: '#00a63e',
    cardRadius: 2,
    btnRadius: 2,
    inputRadius: 2,
    isLight: true,
  },

  // Minimal (.theme-minimal)
  minimal: {
    primary: '#141414',
    primaryHover: '#000000',
    primaryLight: '#f0f0f0',
    secondary: '#6b6b6b',
    secondaryHover: '#4d4d4d',
    accent: '#9a9a9a',
    accentHover: '#7d7d7d',
    background: '#ffffff',
    backgroundAlt: '#fafafa',
    surface: '#ffffff',
    surfaceHover: '#f5f5f5',
    surfaceActive: '#ededed',
    text: '#161616',
    textMuted: '#8e8e8e',
    textInverse: '#ffffff',
    textOnPrimary: '#ffffff',
    border: '#e8e8e8',
    borderStrong: '#d2d2d2',
    borderFocus: '#161616',
    success: '#3f9c6d',
    warning: '#b8902f',
    error: '#c0504d',
    info: '#5a6b7a',
    messageSent: '#161616',
    messageSentText: '#ffffff',
    messageReceived: '#f2f2f2',
    messageReceivedText: '#161616',
    highlightLove: '#6b6b6b',
    highlightFunny: '#8e8e8e',
    highlightImportant: '#c0504d',
    highlightCelebration: '#161616',
    highlightMilestone: '#3f9c6d',
    cardRadius: 8,
    btnRadius: 8,
    inputRadius: 8,
    isLight: true,
  },

  // Retro Arcade — 8-bit CRT (.theme-arcade)
  arcade: {
    primary: '#2bff88',
    primaryHover: '#57ffa3',
    primaryLight: '#0a2415',
    secondary: '#ffd23f',
    secondaryHover: '#ffde6b',
    accent: '#ff5277',
    accentHover: '#ff7593',
    background: '#07140d',
    backgroundAlt: '#0a1a11',
    surface: '#0f2417',
    surfaceHover: '#163322',
    surfaceActive: '#1d422c',
    text: '#e6fff0',
    textMuted: '#6fae86',
    textInverse: '#07140d',
    textOnPrimary: '#04140a',
    border: '#1f5a3a',
    borderStrong: '#2f8f5a',
    borderFocus: '#2bff88',
    success: '#2bff88',
    warning: '#ffd23f',
    error: '#ff5277',
    info: '#57ffa3',
    messageSent: '#2bff88',
    messageSentText: '#04140a',
    messageReceived: '#0f2417',
    messageReceivedText: '#e6fff0',
    highlightLove: '#ff5277',
    highlightFunny: '#ffd23f',
    highlightImportant: '#ff5277',
    highlightCelebration: '#2bff88',
    highlightMilestone: '#57ffa3',
    cardRadius: 0,
    btnRadius: 0,
    inputRadius: 0,
    isLight: false,
  },
};
