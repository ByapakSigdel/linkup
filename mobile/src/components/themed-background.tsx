// Full-screen, per-theme background TEXTURE rendered behind page content.
// Mirrors the web's body::before / body::after layers per theme
// (apps/web/src/styles/globals.css). It is absolutely positioned to fill its
// parent, sits behind content, and never intercepts touches.
//
// pattern -> web theme:
//   stars     Celestial   — faint starfield + soft top vignette glow
//   paper     Love-Letter — faint ruled lines + warm tint
//   dawn      Daybreak    — soft dawn wash (two gradients), no dark texture
//   grid      Brutalist   — engineering grid (1px lines every 28px)
//   none      Minimal     — null (whitespace is the texture)
//   scanlines Arcade      — CRT scanlines + neon bloom top/bottom

import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Line,
  Pattern,
  Rect,
} from 'react-native-svg';
import { useTheme } from '@/theme';

/** Convert a #rrggbb (or #rgb) hex string + alpha (0..1) into an rgba() string. */
function rgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Deterministic starfield for the Celestial theme. Positions are percentages of
// the screen so the field scales with any device size. tint: 0 text, 1 accent,
// 2 primary.
const STARS: { x: number; y: number; r: number; o: number; t: 0 | 1 | 2 }[] = [
  { x: 4, y: 6, r: 1, o: 0.5, t: 0 },
  { x: 12, y: 18, r: 1.4, o: 0.7, t: 0 },
  { x: 20, y: 30, r: 1, o: 0.55, t: 2 },
  { x: 28, y: 9, r: 1, o: 0.4, t: 1 },
  { x: 33, y: 85, r: 1, o: 0.5, t: 1 },
  { x: 38, y: 44, r: 1.4, o: 0.6, t: 0 },
  { x: 5, y: 18, r: 1, o: 0.35, t: 0 },
  { x: 50, y: 60, r: 1.5, o: 0.55, t: 2 },
  { x: 55, y: 24, r: 1, o: 0.45, t: 1 },
  { x: 62, y: 73, r: 1, o: 0.5, t: 0 },
  { x: 65, y: 42, r: 1.4, o: 0.45, t: 1 },
  { x: 70, y: 12, r: 1, o: 0.55, t: 0 },
  { x: 75, y: 15, r: 1.2, o: 0.6, t: 1 },
  { x: 80, y: 55, r: 1, o: 0.4, t: 2 },
  { x: 85, y: 33, r: 1, o: 0.5, t: 0 },
  { x: 88, y: 72, r: 1, o: 0.5, t: 0 },
  { x: 92, y: 20, r: 1.3, o: 0.55, t: 1 },
  { x: 96, y: 48, r: 1, o: 0.4, t: 0 },
  { x: 8, y: 50, r: 1, o: 0.45, t: 2 },
  { x: 15, y: 65, r: 1.2, o: 0.5, t: 0 },
  { x: 22, y: 78, r: 1, o: 0.4, t: 1 },
  { x: 30, y: 55, r: 1, o: 0.5, t: 0 },
  { x: 42, y: 70, r: 1.3, o: 0.45, t: 2 },
  { x: 46, y: 14, r: 1, o: 0.55, t: 0 },
  { x: 58, y: 88, r: 1, o: 0.4, t: 1 },
  { x: 68, y: 62, r: 1.2, o: 0.5, t: 0 },
  { x: 73, y: 90, r: 1, o: 0.45, t: 0 },
  { x: 78, y: 80, r: 1.3, o: 0.5, t: 2 },
  { x: 90, y: 88, r: 1, o: 0.4, t: 1 },
  { x: 94, y: 64, r: 1, o: 0.5, t: 0 },
  { x: 2, y: 38, r: 1, o: 0.4, t: 0 },
  { x: 10, y: 90, r: 1.2, o: 0.45, t: 1 },
  { x: 18, y: 44, r: 1, o: 0.5, t: 0 },
  { x: 26, y: 22, r: 1, o: 0.45, t: 2 },
  { x: 36, y: 33, r: 1.3, o: 0.55, t: 0 },
  { x: 48, y: 50, r: 1, o: 0.4, t: 1 },
  { x: 52, y: 38, r: 1, o: 0.5, t: 0 },
  { x: 60, y: 6, r: 1.2, o: 0.45, t: 0 },
  { x: 82, y: 6, r: 1, o: 0.5, t: 2 },
  { x: 98, y: 84, r: 1, o: 0.4, t: 1 },
];

export function ThemedBackground() {
  const { pattern, colors } = useTheme();
  const { width, height } = useWindowDimensions();

  if (pattern === 'none') return null;

  const fill = StyleSheet.absoluteFill;

  if (pattern === 'stars') {
    const starColor = (t: 0 | 1 | 2) =>
      t === 1 ? colors.accent : t === 2 ? colors.primary : colors.text;
    return (
      <View style={fill} pointerEvents="none">
        <Svg width={width} height={height} style={{ opacity: 0.55 }}>
          {STARS.map((s, i) => (
            <Circle
              key={i}
              cx={(s.x / 100) * width}
              cy={(s.y / 100) * height}
              r={s.r}
              fill={starColor(s.t)}
              opacity={s.o}
            />
          ))}
        </Svg>
        {/* Soft top vignette glow (body::after radial from the top). */}
        <LinearGradient
          colors={[rgba(colors.primary, 0.08), 'transparent']}
          locations={[0, 0.6]}
          style={fill}
          pointerEvents="none"
        />
      </View>
    );
  }

  if (pattern === 'paper') {
    const lines: number[] = [];
    for (let y = 32; y < height; y += 32) lines.push(y);
    return (
      <View style={fill} pointerEvents="none">
        {/* Barely-there warm tint overlay. */}
        <View style={[fill, { backgroundColor: rgba(colors.secondary, 0.03) }]} />
        <Svg width={width} height={height} style={{ opacity: 0.4 }}>
          {lines.map((y, i) => (
            <Line
              key={i}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={rgba(colors.primary, 0.07)}
              strokeWidth={1}
            />
          ))}
        </Svg>
      </View>
    );
  }

  if (pattern === 'dawn') {
    return (
      <View style={fill} pointerEvents="none">
        {/* Dawn wash: primary fading from the top. */}
        <LinearGradient
          colors={[rgba(colors.primary, 0.1), 'transparent']}
          locations={[0, 0.32]}
          style={fill}
          pointerEvents="none"
        />
        {/* Secondary glow from the top-right corner. */}
        <LinearGradient
          colors={[rgba(colors.secondary, 0.12), 'transparent']}
          locations={[0, 0.55]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0.2, y: 0.7 }}
          style={fill}
          pointerEvents="none"
        />
      </View>
    );
  }

  if (pattern === 'grid') {
    // Engineering grid via an SVG <Pattern> — one tile, tiled by the renderer.
    return (
      <View style={fill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <Pattern
              id="lk-grid"
              width={28}
              height={28}
              patternUnits="userSpaceOnUse"
            >
              <Line
                x1={0}
                y1={0}
                x2={28}
                y2={0}
                stroke="rgba(10,10,10,0.06)"
                strokeWidth={1}
              />
              <Line
                x1={0}
                y1={0}
                x2={0}
                y2={28}
                stroke="rgba(10,10,10,0.06)"
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#lk-grid)" />
        </Svg>
      </View>
    );
  }

  if (pattern === 'scanlines') {
    return (
      <View style={fill} pointerEvents="none">
        <Svg width={width} height={height} style={{ opacity: 0.5 }}>
          <Defs>
            <Pattern
              id="lk-scan"
              width={width}
              height={3}
              patternUnits="userSpaceOnUse"
            >
              <Rect
                x={0}
                y={0}
                width={width}
                height={1}
                fill="rgba(0,0,0,0.28)"
              />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width={width} height={height} fill="url(#lk-scan)" />
        </Svg>
        {/* Neon bloom — primary at the top, secondary at the bottom. */}
        <LinearGradient
          colors={[rgba(colors.primary, 0.1), 'transparent']}
          locations={[0, 0.55]}
          style={fill}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', rgba(colors.secondary, 0.08)]}
          locations={[0.45, 1]}
          style={fill}
          pointerEvents="none"
        />
      </View>
    );
  }

  return null;
}
