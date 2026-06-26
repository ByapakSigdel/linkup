import { useEffect, useMemo, useState, type JSX } from 'react';
import { AccessibilityInfo, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/theme';
import type { Star } from './types';
import { CONSTELLATIONS, PROMPTS, placeStar, promptsFor } from './deck';

export interface SkyViewProps {
  stars: Star[];
  onPressStar: (star: Star) => void;
  onPressEmpty?: () => void;
}

/** The logical sky is a 1000x1000 grid; stars carry posX/posY in 0..1000. */
const SKY = 1000;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

/** A deterministic scattering of faint decorative dust, stable across renders. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DUST = (() => {
  const rand = mulberry32(0xc0ffee);
  return Array.from({ length: 70 }, () => ({
    x: +(rand() * SKY).toFixed(1),
    y: +(rand() * SKY).toFixed(1),
    r: +(0.6 + rand() * 1.2).toFixed(2),
    o: +(0.05 + rand() * 0.12).toFixed(3),
  }));
})();

/**
 * A single lit star rendered as three stacked layers — a soft outer glow, a
 * bright core, and a tiny offset highlight glint. The glow opacity breathes via
 * a reanimated loop (staggered by `index` so the field doesn't pulse in unison)
 * unless reduce-motion is on. The core + a larger transparent tap target stay
 * static so taps stay reliable.
 */
function LitStar({
  star,
  index,
  reduceMotion,
  glow,
  core,
  glint,
  onPress,
}: {
  star: Star;
  index: number;
  reduceMotion: boolean;
  glow: string;
  core: string;
  glint: string;
  onPress: (star: Star) => void;
}) {
  const tw = useSharedValue(0.18);

  useEffect(() => {
    if (reduceMotion) {
      tw.value = 0.18;
      return;
    }
    // Period 2.6–3.4s, phase offset by index so they don't pulse together.
    const dur = 2600 + ((index * 137) % 800);
    const delay = (index * 211) % 1400;
    tw.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.24, { duration: dur, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [tw, index, reduceMotion]);

  const haloProps = useAnimatedProps(() => ({ opacity: tw.value }));

  return (
    <G>
      {/* Twinkling outer glow */}
      <AnimatedCircle cx={star.posX} cy={star.posY} r={16} fill={glow} animatedProps={haloProps} />
      {/* Bright core */}
      <Circle cx={star.posX} cy={star.posY} r={5} fill={core} />
      {/* Glint highlight, offset up-left */}
      <Circle cx={star.posX - 1.5} cy={star.posY - 1.5} r={1.3} fill={glint} opacity={0.9} />
      {/* Transparent tap target */}
      <Circle
        cx={star.posX}
        cy={star.posY}
        r={18}
        fill={core}
        opacity={0}
        onPress={() => onPress(star)}
      />
    </G>
  );
}

/**
 * The connecting lines + centroid label for one completed constellation. The
 * lines draw themselves in once on mount via a stroke-dashoffset sweep
 * (instant when reduce-motion is on). A simple mount animation is intentional —
 * we don't track per-segment first-seen state.
 */
function ConstellationLines({
  c,
  reduceMotion,
  stroke,
  labelColor,
  fontFamily,
}: {
  c: { key: string; name: string; points: Star[]; labelX: number; labelY: number };
  reduceMotion: boolean;
  stroke: string;
  labelColor: string;
  fontFamily: string;
}) {
  const segments = useMemo(
    () =>
      c.points.slice(1).map((s, i) => {
        const prev = c.points[i]!;
        const len = Math.hypot(s.posX - prev.posX, s.posY - prev.posY);
        return { x1: prev.posX, y1: prev.posY, x2: s.posX, y2: s.posY, len };
      }),
    [c.points],
  );

  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion, c.key]);

  return (
    <G>
      {segments.map((seg, i) => (
        <DrawnSegment key={`${c.key}-seg-${i}`} seg={seg} progress={progress} stroke={stroke} />
      ))}
      <SvgText
        x={c.labelX}
        y={c.labelY - 28}
        fill={labelColor}
        fontFamily={fontFamily}
        fontSize={19}
        textAnchor="middle"
        opacity={0.7}
      >
        {c.name}
      </SvgText>
    </G>
  );
}

function DrawnSegment({
  seg,
  progress,
  stroke,
}: {
  seg: { x1: number; y1: number; x2: number; y2: number; len: number };
  progress: SharedValue<number>;
  stroke: string;
}) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: seg.len * (1 - progress.value),
  }));
  return (
    <AnimatedLine
      x1={seg.x1}
      y1={seg.y1}
      x2={seg.x2}
      y2={seg.y2}
      stroke={stroke}
      strokeWidth={1.2}
      strokeOpacity={0.4}
      strokeDasharray={seg.len}
      animatedProps={animatedProps}
    />
  );
}

export function SkyView({ stars, onPressStar, onPressEmpty }: SkyViewProps): JSX.Element {
  const { colors, fonts, isLight } = useTheme();
  const { width: vw, height: vh } = useWindowDimensions();

  // The glint is a physical highlight, so it must be lighter than the core. On
  // LIGHT themes the primary core is dark and `textOnPrimary` is light, so use
  // it; on dark themes the core is already light, where plain white reads as a
  // true highlight (the brief explicitly permits white for the glint).
  const glintColor = isLight ? colors.textOnPrimary : '#ffffff';

  // Respect the OS reduce-motion setting; subscribe to live changes.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  // A square canvas larger than the viewport so there is room to pan around.
  const canvas = Math.max(vw, vh) * 1.4;

  // How far the canvas can travel before its edge would cross into view.
  const maxX = Math.max(0, (canvas - vw) / 2);
  const maxY = Math.max(0, (canvas - vh) / 2);

  // Start centered.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    // Small threshold so taps on stars are not swallowed by the pan recognizer.
    .minDistance(6)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      // Clamp inline (Math.* is UI-thread safe) so the sky can't pan off-screen.
      translateX.value = Math.min(maxX, Math.max(-maxX, startX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(-maxY, startY.value + e.translationY));
    });

  const canvasStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const litStars = useMemo(() => stars.filter((s) => s.status === 'lit'), [stars]);
  const otherStars = useMemo(() => stars.filter((s) => s.status !== 'lit'), [stars]);

  // Lit stars keyed by promptKey for quick lookup when drawing lines.
  const litByPrompt = useMemo(() => {
    const m = new Map<string, Star>();
    for (const s of litStars) if (s.promptKey) m.set(s.promptKey, s);
    return m;
  }, [litStars]);

  // Constellations whose every non-spicy prompt has a lit star: draw lines + label.
  const completed = useMemo(() => {
    return CONSTELLATIONS.map((c) => {
      const reqd = promptsFor(c.key).filter((p) => p.tier !== 'spicy');
      const litReqd = reqd.filter((p) => litByPrompt.has(p.key));
      const complete = reqd.length > 0 && litReqd.length === reqd.length;
      if (!complete) return null;
      const points = reqd
        .map((p) => litByPrompt.get(p.key))
        .filter((s): s is Star => Boolean(s));
      if (points.length === 0) return null;
      const cx = points.reduce((a, s) => a + s.posX, 0) / points.length;
      const cy = points.reduce((a, s) => a + s.posY, 0) / points.length;
      return { key: c.key, name: c.name, points, labelX: cx, labelY: cy };
    }).filter((c): c is NonNullable<typeof c> => Boolean(c));
  }, [litByPrompt]);

  // Every prompt that already has a star (lit OR in-progress) — so we don't draw
  // a dim pending marker stacked under an in-progress star at the same spot.
  const starredPrompts = useMemo(() => {
    const s = new Set<string>();
    for (const st of stars) if (st.promptKey) s.add(st.promptKey);
    return s;
  }, [stars]);

  // Pending markers: every non-spicy curated prompt with no star of any kind yet.
  const pendingMarkers = useMemo(() => {
    return PROMPTS.filter(
      (p) => p.tier !== 'spicy' && !starredPrompts.has(p.key),
    ).map((p) => {
      const pos = placeStar(p.constellationKey, p.key);
      return { key: p.key, x: pos.posX, y: pos.posY };
    });
  }, [starredPrompts]);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              width: canvas,
              height: canvas,
              // Center the larger canvas over the viewport before panning.
              marginLeft: -(canvas - vw) / 2,
              marginTop: -(canvas - vh) / 2,
            },
            canvasStyle,
          ]}
        >
          <Svg width={canvas} height={canvas} viewBox={`0 0 ${SKY} ${SKY}`}>
            {/* Background tap target (empty sky). */}
            <Rect
              x={0}
              y={0}
              width={SKY}
              height={SKY}
              fill="transparent"
              onPress={() => onPressEmpty?.()}
            />

            {/* Faint decorative dust. */}
            {DUST.map((d, i) => (
              <Circle
                key={`dust-${i}`}
                cx={d.x}
                cy={d.y}
                r={d.r}
                fill={colors.textMuted}
                opacity={d.o}
              />
            ))}

            {/* Constellation lines + labels for completed constellations. */}
            {completed.map((c) => (
              <ConstellationLines
                key={`line-${c.key}`}
                c={c}
                reduceMotion={reduceMotion}
                stroke={colors.primary}
                labelColor={colors.text}
                fontFamily={fonts.display}
              />
            ))}

            {/* Pending markers (non-spicy prompts without a lit star). */}
            {pendingMarkers.map((m) => (
              <Circle
                key={`pending-${m.key}`}
                cx={m.x}
                cy={m.y}
                r={2.5}
                fill={colors.textMuted}
                opacity={0.28}
              />
            ))}

            {/* In-progress stars (e.g. a half-answered guess) — "kindling". */}
            {otherStars.map((s) => (
              <G key={`star-${s.id}`}>
                <Circle cx={s.posX} cy={s.posY} r={10} fill={colors.secondary} opacity={0.12} />
                <Circle cx={s.posX} cy={s.posY} r={4} fill={colors.secondary} opacity={0.7} />
                <Circle
                  cx={s.posX}
                  cy={s.posY}
                  r={18}
                  fill={colors.secondary}
                  opacity={0}
                  onPress={() => onPressStar(s)}
                />
              </G>
            ))}

            {/* Lit stars (3-layer luminous: glow + core + glint). On light themes
                the primary core is dark, so the on-primary token (white) glints;
                on dark themes the core is light, where a plain white glint reads
                as a true highlight. Pick the lighter of the two per theme. */}
            {litStars.map((s, i) => (
              <LitStar
                key={`lit-${s.id}`}
                star={s}
                index={i}
                reduceMotion={reduceMotion}
                glow={colors.primary}
                core={colors.primary}
                glint={glintColor}
                onPress={onPressStar}
              />
            ))}
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
});
