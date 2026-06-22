import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Line,
  Rect,
  RadialGradient,
  Stop,
} from 'react-native-svg';

/**
 * The midnight-constellation backdrop shared by LinkUp's front door (landing +
 * auth). A real star-chart feel: deep-space gradient, a faint RA/Dec graticule,
 * a pre-dawn glow at the horizon ("the hours between midnight and dawn"), and a
 * field of quietly twinkling stars.
 *
 * Ported from apps/web/src/components/brand/constellation-sky.tsx. Star
 * positions come from a fixed seed so the field is deterministic. Color-LOCKED
 * to the Celestial (midnight) palette — literal hexes match the web source.
 */

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
  oHi: number;
  tw: boolean;
  dur: number;
  delay: number;
}

/** Deterministic PRNG (mulberry32) so the field is stable across renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStars(count: number, seed: number): Star[] {
  const rand = mulberry32(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const r = rand();
    // Dim, mostly faint dust — easy on the eyes against the soft-dark sky.
    const o = +(0.12 + r * 0.34).toFixed(2);
    stars.push({
      x: +(rand() * 100).toFixed(2),
      y: +(rand() * 100).toFixed(2),
      r: +(0.4 + r * r * 1.3).toFixed(2),
      o,
      oHi: +Math.min(o + 0.18, 0.62).toFixed(2),
      // Only about a third gently breathe; the rest hold steady (less motion).
      tw: rand() < 0.34,
      dur: +(6 + rand() * 4).toFixed(2),
      delay: +(rand() * 6).toFixed(2),
    });
  }
  return stars;
}

const STARS = buildStars(58, 0x5eed1e);

/** RA/Dec-style coordinate lines (percentages of the viewport). */
const V_LINES = [16, 33, 50, 67, 84];
const H_LINES = [22, 44, 66, 88];

const AnimatedView = Animated.View;

function TwinkleStar({ star, w, h }: { star: Star; w: number; h: number }) {
  const op = useSharedValue(star.o);

  useEffect(() => {
    op.value = withDelay(
      star.delay * 1000,
      withRepeat(
        withTiming(star.oHi, {
          duration: star.dur * 1000,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
  }, [op, star.delay, star.dur, star.oHi]);

  const animStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <AnimatedView
      style={[
        {
          position: 'absolute',
          left: (star.x / 100) * w,
          top: (star.y / 100) * h,
          width: star.r,
          height: star.r,
          borderRadius: star.r / 2,
          backgroundColor: '#dcd8cf',
        },
        animStyle,
      ]}
    />
  );
}

export function ConstellationSky() {
  const { width: w, height: h } = useWindowDimensions();

  // The whole star field drifts almost imperceptibly for depth (lk-float):
  // translate ~ +6,-8 over 22s, reversing.
  const drift = useSharedValue(0);
  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [drift]);

  const driftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 6 },
      { translateY: drift.value * -8 },
    ],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      {/* Deep-space depth washes + pre-dawn horizon glow (SVG radial gradients). */}
      <Svg
        style={StyleSheet.absoluteFill}
        width={w}
        height={h}
        pointerEvents="none"
      >
        <Defs>
          {/* (a) cool wash top-right */}
          <RadialGradient
            id="coolWash"
            cx="78%"
            cy="-10%"
            rx="120%"
            ry="80%"
            gradientUnits="userSpaceOnUse"
            fx="78%"
            fy="-10%"
          >
            <Stop offset="0" stopColor="#aec5d8" stopOpacity={0.06} />
            <Stop offset="0.55" stopColor="#aec5d8" stopOpacity={0} />
          </RadialGradient>
          {/* (b) faint lilac nebula top-left */}
          <RadialGradient
            id="lilacNebula"
            cx="12%"
            cy="8%"
            rx="90%"
            ry="70%"
            gradientUnits="userSpaceOnUse"
            fx="12%"
            fy="8%"
          >
            <Stop offset="0" stopColor="#c4a8e0" stopOpacity={0.05} />
            <Stop offset="0.5" stopColor="#c4a8e0" stopOpacity={0} />
          </RadialGradient>
          {/* (c) pre-dawn glow at the bottom — amber warming through periwinkle. */}
          <RadialGradient
            id="preDawn"
            cx="50%"
            cy="150%"
            rx="120%"
            ry="100%"
            gradientUnits="userSpaceOnUse"
            fx="50%"
            fy="150%"
          >
            <Stop offset="0" stopColor="#d4a574" stopOpacity={0.09} />
            <Stop offset="0.32" stopColor="#aec5d8" stopOpacity={0.06} />
            <Stop offset="0.62" stopColor="#aec5d8" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width={w} height={h} fill="url(#coolWash)" />
        <Rect x={0} y={0} width={w} height={h} fill="url(#lilacNebula)" />
        {/* Pre-dawn glow anchored to the bottom ~42% of the screen. */}
        <Rect
          x={0}
          y={h * 0.58}
          width={w}
          height={h * 0.42}
          fill="url(#preDawn)"
        />

        {/* Coordinate graticule — faded with low opacity (no mask needed). */}
        {V_LINES.map((x) => (
          <Line
            key={`v${x}`}
            x1={(x / 100) * w}
            y1={0}
            x2={(x / 100) * w}
            y2={h}
            stroke="#aec5d8"
            strokeWidth={0.5}
            strokeOpacity={0.035}
          />
        ))}
        {H_LINES.map((y) => (
          <Line
            key={`h${y}`}
            x1={0}
            y1={(y / 100) * h}
            x2={w}
            y2={(y / 100) * h}
            stroke="#aec5d8"
            strokeWidth={0.5}
            strokeOpacity={0.035}
          />
        ))}
      </Svg>

      {/* Star field — dim, mostly steady, a third gently breathing; the whole
          field drifts almost imperceptibly for depth. */}
      <AnimatedView
        style={[StyleSheet.absoluteFill, driftStyle]}
        pointerEvents="none"
      >
        {STARS.map((s, i) =>
          s.tw ? (
            <TwinkleStar key={i} star={s} w={w} h={h} />
          ) : (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: (s.x / 100) * w,
                top: (s.y / 100) * h,
                width: s.r,
                height: s.r,
                borderRadius: s.r / 2,
                backgroundColor: '#dcd8cf',
                opacity: s.o,
              }}
            />
          ),
        )}
      </AnimatedView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#14171f',
    overflow: 'hidden',
  },
});
