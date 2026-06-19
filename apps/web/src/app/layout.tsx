import type { Metadata } from 'next';
import {
  Fraunces,
  Hanken_Grotesk,
  Instrument_Serif,
  Space_Mono,
  Caveat,
  Archivo_Black,
  Space_Grotesk,
  Inter,
  Press_Start_2P,
  VT323,
} from 'next/font/google';
import { ThemeProvider } from '@/components/theme/theme-provider';
import '@/styles/globals.css';

// Editorial serif — intimate headings (Celestial / Daybreak display)
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT'],
});

// Clean grotesque — body text across themes
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hanken',
});

// Romantic serif — Love-Letter display
const instrument = Instrument_Serif({
  subsets: ['latin'],
  display: 'swap',
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument',
});

// Typewriter / data mono
const spaceMono = Space_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '700'],
  variable: '--font-space-mono',
});

// Handwriting accent — Love-Letter doodle labels
const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

// Heavy grotesque display — Neo-Brutalism
const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-archivo',
});

// Geometric grotesque body — Neo-Brutalism
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-grotesk',
});

// Neutral grotesque — Minimalism
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

// Pixel display — Retro 8-bit
const pressStart = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-pixel',
});

// Readable pixel body — Retro 8-bit
const vt323 = VT323({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-vt323',
});

export const metadata: Metadata = {
  title: 'linkup — your constellation of two',
  description:
    'A private space for couples to connect, share, and grow together. Made for the hours between midnight and dawn.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const fontVars = [
    fraunces.variable,
    hanken.variable,
    instrument.variable,
    spaceMono.variable,
    caveat.variable,
    archivoBlack.variable,
    spaceGrotesk.variable,
    inter.variable,
    pressStart.variable,
    vt323.variable,
  ].join(' ');

  // Applies the persisted theme class before first paint to avoid a flash and
  // to keep localStorage authoritative across reloads.
  const themeBootstrap = `(function(){try{var s=localStorage.getItem('theme-storage');var id='default';if(s){var p=JSON.parse(s);if(p&&p.state&&p.state.currentThemeId){id=p.state.currentThemeId;}}var r=document.documentElement;r.classList.forEach(function(c){if(c.indexOf('theme-')===0)r.classList.remove(c);});r.classList.add('theme-'+id);}catch(e){}})();`;

  return (
    <html
      lang="en"
      className={`${fontVars} theme-default`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
