import { useEffect, useMemo, type JSX } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
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

// TODO(task10): wire global reduce-motion. The app exposes a per-user
// `reduceMotion` setting (see app/(app)/settings.tsx + /users/me/settings) but
// there is no global store/hook for it yet. Until that lands, twinkle is on by
// default; flip this to true (or read the real preference) to render static stars.
const reduceMotion = false;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
 * A single lit star: a steady bright core with a softly twinkling halo behind
 * it. The halo opacity breathes via a reanimated loop unless reduce-motion is
 * on. A larger transparent circle on top captures taps.
 */
function LitStar({
  star,
  color,
  onPress,
}: {
  star: Star;
  color: string;
  onPress: (star: Star) => void;
}) {
  const tw = useSharedValue(0.35);

  useEffect(() => {
    if (reduceMotion) return;
    // Stagger by position so the field doesn't pulse in unison.
    const dur = 2200 + ((Math.round(star.posX + star.posY) % 1800) | 0);
    tw.value = withRepeat(
      withTiming(0.6, { duration: dur, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [tw, star.posX, star.posY]);

  const haloProps = useAnimatedProps(() => ({ opacity: reduceMotion ? 0.35 : tw.value }));

  return (
    <G>
      {/* Twinkling glow halo */}
      <AnimatedCircle
        cx={star.posX}
        cy={star.posY}
        r={14}
        fill={color}
        animatedProps={haloProps}
      />
      {/* Bright core */}
      <Circle cx={star.posX} cy={star.posY} r={6} fill={color} />
      {/* Transparent tap target */}
      <Circle
        cx={star.posX}
        cy={star.posY}
        r={18}
        fill={color}
        opacity={0}
        onPress={() => onPress(star)}
      />
    </G>
  );
}

export function SkyView({ stars, onPressStar, onPressEmpty }: SkyViewProps): JSX.Element {
  const { colors } = useTheme();
  const { width: vw, height: vh } = useWindowDimensions();

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
              <G key={`line-${c.key}`}>
                {c.points.slice(1).map((s, i) => {
                  const prev = c.points[i]!;
                  return (
                    <Line
                      key={`${c.key}-seg-${i}`}
                      x1={prev.posX}
                      y1={prev.posY}
                      x2={s.posX}
                      y2={s.posY}
                      stroke={colors.primary}
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                    />
                  );
                })}
                <SvgText
                  x={c.labelX}
                  y={c.labelY - 26}
                  fill={colors.text}
                  fontSize={20}
                  textAnchor="middle"
                  opacity={0.85}
                >
                  {c.name}
                </SvgText>
              </G>
            ))}

            {/* Pending markers (non-spicy prompts without a lit star). */}
            {pendingMarkers.map((m) => (
              <Circle
                key={`pending-${m.key}`}
                cx={m.x}
                cy={m.y}
                r={3}
                fill={colors.textMuted}
                opacity={0.3}
              />
            ))}

            {/* Non-lit stars (e.g. a half-answered guess). */}
            {otherStars.map((s) => (
              <G key={`star-${s.id}`}>
                <Circle cx={s.posX} cy={s.posY} r={4} fill={colors.secondary} opacity={0.6} />
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

            {/* Lit stars (bright core + twinkling halo). */}
            {litStars.map((s) => (
              <LitStar key={`lit-${s.id}`} star={s} color={colors.primary} onPress={onPressStar} />
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
