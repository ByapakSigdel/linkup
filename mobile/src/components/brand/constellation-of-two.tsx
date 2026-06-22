import { useEffect } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/**
 * The hero figure of LinkUp's front door: two stars — a couple — plotted on the
 * sky and joined by a bond line that draws itself in, with a lilac "link point"
 * igniting between them. The logo mark told at full scale.
 *
 * BRAND component — color-LOCKED to the Celestial (midnight) palette. Colors are
 * the literal hexes ported from apps/web/src/components/brand/constellation-of-two.tsx.
 * Animations mirror the web `.lk-*` CSS keyframes via reanimated.
 */

const AEllipse = Animated.createAnimatedComponent(Ellipse);
const ALine = Animated.createAnimatedComponent(Line);
const AG = Animated.createAnimatedComponent(G);

const VIEW_W = 420;
const VIEW_H = 380;

export function ConstellationOfTwo({ size }: { size?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const width = size ?? Math.min(360, screenWidth - 48);
  const height = width * (VIEW_H / VIEW_W);

  // --- shared values ---------------------------------------------------------
  const orbitDash = useSharedValue(0); // strokeDashoffset 0 -> -200 (38s linear loop)
  const drift = useSharedValue(0); // gentle group drift, -10px at mid (16s loop)

  const asterismOpacity = useSharedValue(0); // fade in, delay 0.9s
  const tagsOpacity = useSharedValue(0); // fade in, delay 2s

  const bondDashOffset = useSharedValue(240); // draw-on 240 -> 0, 1.5s, delay 0.4s

  const glowBig = useSharedValue(0); // 0..1 phase for the breathing glow
  const glowSmall = useSharedValue(0);
  const glowLink = useSharedValue(0);

  const popBig = useSharedValue(0.2); // inner star pop scale 0.2 -> 1, delay 0.5s
  const popSmall = useSharedValue(0.2); // delay 0.95s
  const popBigOpacity = useSharedValue(0);
  const popSmallOpacity = useSharedValue(0);

  const igniteScale = useSharedValue(0); // sparkle ignite 0 -> 1.5 -> 1, delay 1.7s
  const igniteOpacity = useSharedValue(0);
  const sparklePulse = useSharedValue(1); // gentle 1 <-> 1.12 loop, delay 2.6s

  useEffect(() => {
    // Orbit dash flow — continuous linear loop (lkOrbitFlow, 38s).
    orbitDash.value = withRepeat(
      withTiming(-200, { duration: 38000, easing: Easing.linear }),
      -1,
      false,
    );

    // Gentle group drift (lkDrift, 16s ease-in-out, -10px at midpoint).
    drift.value = withRepeat(
      withTiming(-10, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    // Asterism + coordinate tags fade in.
    asterismOpacity.value = withDelay(900, withTiming(1, { duration: 1400, easing: Easing.ease }));
    tagsOpacity.value = withDelay(2000, withTiming(1, { duration: 1400, easing: Easing.ease }));

    // Bond line draws on (lkDrawLine, 1.5s cubic-bezier, delay 0.4s).
    bondDashOffset.value = withDelay(
      400,
      withTiming(0, { duration: 1500, easing: Easing.bezier(0.65, 0, 0.35, 1) }),
    );

    // Breathing glow haloes (lkPulseGlow, 4.5s ease-in-out, staggered).
    const breathe = (sv: typeof glowBig, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withTiming(1, { duration: 2250, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      );
    };
    breathe(glowBig, 0);
    breathe(glowSmall, 1400);
    breathe(glowLink, 2400);

    // Inner stars pop in (lkStarPop, 0.9s cubic-bezier(0.16,1,0.3,1)).
    const pop = Easing.bezier(0.16, 1, 0.3, 1);
    popBig.value = withDelay(500, withTiming(1, { duration: 900, easing: pop }));
    popBigOpacity.value = withDelay(500, withTiming(1, { duration: 900, easing: pop }));
    popSmall.value = withDelay(950, withTiming(1, { duration: 900, easing: pop }));
    popSmallOpacity.value = withDelay(950, withTiming(1, { duration: 900, easing: pop }));

    // Link-point sparkle ignites (lkIgnite, 0.9s, delay 1.7s): 0 -> 1.5 -> 1.
    igniteOpacity.value = withDelay(1700, withTiming(1, { duration: 500, easing: pop }));
    igniteScale.value = withDelay(
      1700,
      withSequence(
        withTiming(1.5, { duration: 495, easing: pop }), // ~55% of 0.9s
        withTiming(1, { duration: 405, easing: pop }),
      ),
    );
    // ...then keeps a gentle sparkle pulse (lkSparklePulse, 3.6s, delay 2.6s).
    sparklePulse.value = withDelay(
      2600,
      withRepeat(
        withTiming(1.12, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [
    orbitDash,
    drift,
    asterismOpacity,
    tagsOpacity,
    bondDashOffset,
    glowBig,
    glowSmall,
    glowLink,
    popBig,
    popSmall,
    popBigOpacity,
    popSmallOpacity,
    igniteScale,
    igniteOpacity,
    sparklePulse,
  ]);

  // --- animated props --------------------------------------------------------
  const orbitProps = useAnimatedProps(() => ({
    strokeDashoffset: orbitDash.value,
  }));

  // Drift transform on the orbit group.
  const driftProps = useAnimatedProps(() => ({
    transform: [{ translateY: drift.value }] as never,
  }));

  const asterismProps = useAnimatedProps(() => ({ opacity: asterismOpacity.value }));
  const tagsProps = useAnimatedProps(() => ({ opacity: tagsOpacity.value }));

  const bondProps = useAnimatedProps(() => ({
    strokeDashoffset: bondDashOffset.value,
  }));

  // Breathing glow: opacity 0.05 <-> 0.16, scale 1 <-> 1.3, about a fixed center.
  const glowAt = (sv: typeof glowBig, cx: number, cy: number) =>
    useAnimatedProps(() => {
      const opacity = 0.05 + (0.16 - 0.05) * sv.value;
      const scale = 1 + (1.3 - 1) * sv.value;
      return {
        opacity,
        transform: [
          { translateX: cx },
          { translateY: cy },
          { scale },
          { translateX: -cx },
          { translateY: -cy },
        ] as never,
      };
    });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const glowBigProps = glowAt(glowBig, 120, 250);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const glowSmallProps = glowAt(glowSmall, 310, 120);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const glowLinkProps = glowAt(glowLink, 215, 185);

  // Inner star pop (scale about its own center).
  const popAt = (
    scaleSv: typeof popBig,
    opacitySv: typeof popBigOpacity,
    cx: number,
    cy: number,
  ) =>
    useAnimatedProps(() => ({
      opacity: opacitySv.value,
      transform: [
        { translateX: cx },
        { translateY: cy },
        { scale: scaleSv.value },
        { translateX: -cx },
        { translateY: -cy },
      ] as never,
    }));

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const popBigProps = popAt(popBig, popBigOpacity, 120, 250);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const popSmallProps = popAt(popSmall, popSmallOpacity, 310, 120);

  // Sparkle: ignite scale * ongoing pulse, about the link point's local origin (0,0).
  const sparkleProps = useAnimatedProps(() => ({
    opacity: igniteOpacity.value,
    transform: [{ scale: igniteScale.value * sparklePulse.value }] as never,
  }));

  const mono = 'SpaceMono_400Regular';

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} fill="none">
      {/* Faint orbit the pair share — drifts gently while its dashes flow. */}
      <AG animatedProps={driftProps}>
        <AEllipse
          cx={215}
          cy={185}
          rx={158}
          ry={118}
          stroke="#a8bfd4"
          strokeWidth={0.75}
          strokeOpacity={0.16}
          strokeDasharray="2 7"
          animatedProps={orbitProps}
        />
      </AG>

      {/* Companion stars + a thin asterism, so the pair reads as a constellation. */}
      <AG animatedProps={asterismProps}>
        <Line x1={60} y1={92} x2={120} y2={250} stroke="#a8bfd4" strokeWidth={0.5} strokeOpacity={0.12} />
        <Line x1={310} y1={120} x2={372} y2={206} stroke="#a8bfd4" strokeWidth={0.5} strokeOpacity={0.12} />
        {(
          [
            [60, 92, 1.6],
            [200, 44, 1.3],
            [372, 206, 1.8],
            [330, 318, 1.2],
            [44, 300, 1.4],
          ] as const
        ).map(([cx, cy, r], i) => (
          <Circle key={i} cx={cx} cy={cy} r={r} fill="#e8e4dc" fillOpacity={0.5} />
        ))}
      </AG>

      {/* Bond line — draws on. */}
      <ALine
        x1={120}
        y1={250}
        x2={310}
        y2={120}
        stroke="#a8bfd4"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeDasharray="240"
        animatedProps={bondProps}
      />

      {/* Large star — amber, with a breathing glow. */}
      <AG animatedProps={glowBigProps}>
        <Circle cx={120} cy={250} r={20} fill="#d4a574" />
      </AG>
      <AG animatedProps={popBigProps}>
        <Circle cx={120} cy={250} r={11} fill="#cfa170" />
      </AG>

      {/* Small star — starlight, with a breathing glow. */}
      <AG animatedProps={glowSmallProps}>
        <Circle cx={310} cy={120} r={14} fill="#e8e4dc" />
      </AG>
      <AG animatedProps={popSmallProps}>
        <Circle cx={310} cy={120} r={6.5} fill="#ddd8cf" />
      </AG>

      {/* Link point — lilac sparkle igniting at the midpoint of the bond.
          The translate(215,185) lives on the outer group so the sparkle's scale
          animation (on the inner group) doesn't override its position. */}
      <AG animatedProps={glowLinkProps}>
        <Circle cx={215} cy={185} r={13} fill="#c4a8e0" />
      </AG>
      <G transform="translate(215 185)">
        <AG animatedProps={sparkleProps}>
          <Path
            d="M0,-15 C1.6,-4.2 4.2,-1.6 15,0 C4.2,1.6 1.6,4.2 0,15 C-1.6,4.2 -4.2,1.6 -15,0 C-4.2,-1.6 -1.6,-4.2 0,-15 Z"
            fill="#c4a8e0"
          />
        </AG>
      </G>

      {/* Star-chart coordinate tags. */}
      <AG animatedProps={tagsProps}>
        <SvgText
          x={120}
          y={284}
          fill="#9aa3b4"
          fontFamily={mono}
          fontSize={9.5}
          textAnchor="middle"
        >
          21ʰ 14ᵐ
        </SvgText>
        <SvgText
          x={310}
          y={100}
          fill="#9aa3b4"
          fontFamily={mono}
          fontSize={9.5}
          textAnchor="middle"
        >
          +38° 47′
        </SvgText>
      </AG>
    </Svg>
  );
}
