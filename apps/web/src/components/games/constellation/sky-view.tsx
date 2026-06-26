'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Star } from './types';
import { CONSTELLATIONS, PROMPTS, placeStar, promptsFor } from './deck';

export interface SkyViewProps {
  stars: Star[];
  onPressStar: (star: Star) => void;
  onPressEmpty?: () => void;
}

/** The logical sky is a 1000x1000 grid; stars carry posX/posY in 0..1000. */
const SKY = 1000;

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

/** Reads the user's reduce-motion preference once, after mount (SSR-safe). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * A single lit star rendered as three stacked layers — a soft outer glow, a
 * bright core, and a tiny offset highlight glint. The glow opacity breathes via
 * a CSS animation (staggered by `index` so the field doesn't pulse in unison)
 * unless reduce-motion is on. The core + a larger transparent click target stay
 * static so taps stay reliable.
 */
function LitStar({
  star,
  index,
  reduceMotion,
  onPress,
}: {
  star: Star;
  index: number;
  reduceMotion: boolean;
  onPress: (star: Star) => void;
}) {
  // Period 2.6–3.4s, phase offset by index so they don't pulse together.
  const dur = 2600 + ((index * 137) % 800);
  const delay = (index * 211) % 1400;

  return (
    <g>
      {/* Twinkling outer glow */}
      <circle
        cx={star.posX}
        cy={star.posY}
        r={16}
        fill="var(--color-primary)"
        opacity={0.18}
        style={
          reduceMotion
            ? undefined
            : {
                animation: `lk-twinkle ${dur}ms ease-in-out ${delay}ms infinite alternate`,
              }
        }
      />
      {/* Bright core */}
      <circle cx={star.posX} cy={star.posY} r={5} fill="var(--color-primary)" />
      {/* Glint highlight, offset up-left */}
      <circle cx={star.posX - 1.5} cy={star.posY - 1.5} r={1.3} fill="#ffffff" opacity={0.9} />
      {/* Transparent click/tap target */}
      <circle
        cx={star.posX}
        cy={star.posY}
        r={18}
        fill="var(--color-primary)"
        opacity={0}
        style={{ cursor: 'pointer' }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onPress(star)}
      />
    </g>
  );
}

export function SkyView({ stars, onPressStar, onPressEmpty }: SkyViewProps) {
  const reduceMotion = usePrefersReducedMotion();

  // Pan state: translate the <g> by (tx, ty) within the viewBox space.
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    active: boolean;
    moved: boolean;
    startClientX: number;
    startClientY: number;
    startTx: number;
    startTy: number;
    scale: number;
  }>({
    active: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startTx: 0,
    startTy: 0,
    scale: 1,
  });
  const svgRef = useRef<SVGSVGElement>(null);

  // How far the canvas can travel (in viewBox units) before its edge crosses in.
  // The viewBox is square (SKY x SKY); allow panning up to ~30% of the field.
  const MAX = SKY * 0.3;

  function clamp(v: number): number {
    return Math.min(MAX, Math.max(-MAX, v));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    // Convert client px to viewBox units so the drag tracks 1:1 with the field.
    const rect = svg?.getBoundingClientRect();
    const scale = rect && rect.width > 0 ? SKY / rect.width : 1;
    drag.current = {
      active: true,
      moved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTx: translate.x,
      startTy: translate.y,
      scale,
    };
    svg?.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d.active) return;
    const dx = (e.clientX - d.startClientX) * d.scale;
    const dy = (e.clientY - d.startClientY) * d.scale;
    if (Math.abs(e.clientX - d.startClientX) > 4 || Math.abs(e.clientY - d.startClientY) > 4) {
      d.moved = true;
    }
    setTranslate({ x: clamp(d.startTx + dx), y: clamp(d.startTy + dy) });
  }

  function endDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (drag.current.active) {
      svgRef.current?.releasePointerCapture?.(e.pointerId);
    }
    drag.current.active = false;
  }

  function onBackgroundClick() {
    // Only treat as an "empty sky" tap if this wasn't the tail of a pan.
    if (drag.current.moved) return;
    onPressEmpty?.();
  }

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
    <div className="relative h-full w-full overflow-hidden">
      <style>{`
        @keyframes lk-twinkle { from { opacity: 0.12; } to { opacity: 0.24; } }
        @keyframes lk-draw { from { stroke-dashoffset: var(--lk-len); } to { stroke-dashoffset: 0; } }
      `}</style>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${SKY} ${SKY}`}
        preserveAspectRatio="xMidYMid slice"
        style={{ touchAction: 'none', cursor: drag.current.active ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        <g transform={`translate(${translate.x} ${translate.y})`}>
          {/* Background tap target (empty sky). */}
          <rect
            x={0}
            y={0}
            width={SKY}
            height={SKY}
            fill="transparent"
            onClick={onBackgroundClick}
          />

          {/* Faint decorative dust. */}
          {DUST.map((d, i) => (
            <circle
              key={`dust-${i}`}
              cx={d.x}
              cy={d.y}
              r={d.r}
              fill="var(--color-text-muted)"
              opacity={d.o}
            />
          ))}

          {/* Constellation lines + labels for completed constellations. */}
          {completed.map((c) => (
            <g key={`line-${c.key}`}>
              {c.points.slice(1).map((s, i) => {
                const prev = c.points[i]!;
                const len = Math.hypot(s.posX - prev.posX, s.posY - prev.posY);
                return (
                  <line
                    key={`${c.key}-seg-${i}`}
                    x1={prev.posX}
                    y1={prev.posY}
                    x2={s.posX}
                    y2={s.posY}
                    stroke="var(--color-primary)"
                    strokeWidth={1.2}
                    strokeOpacity={0.4}
                    strokeDasharray={len}
                    style={
                      reduceMotion
                        ? undefined
                        : ({
                            ['--lk-len' as string]: String(len),
                            animation: `lk-draw 700ms ease-out ${i * 90}ms both`,
                          } as React.CSSProperties)
                    }
                  />
                );
              })}
              <text
                x={c.labelX}
                y={c.labelY - 28}
                fill="var(--color-text)"
                fontSize={19}
                textAnchor="middle"
                opacity={0.7}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {c.name}
              </text>
            </g>
          ))}

          {/* Pending markers (non-spicy prompts without a lit star). */}
          {pendingMarkers.map((m) => (
            <circle
              key={`pending-${m.key}`}
              cx={m.x}
              cy={m.y}
              r={2.5}
              fill="var(--color-text-muted)"
              opacity={0.28}
            />
          ))}

          {/* In-progress stars (e.g. a half-answered guess) — "kindling". */}
          {otherStars.map((s) => (
            <g key={`star-${s.id}`}>
              <circle cx={s.posX} cy={s.posY} r={10} fill="var(--color-secondary)" opacity={0.12} />
              <circle cx={s.posX} cy={s.posY} r={4} fill="var(--color-secondary)" opacity={0.7} />
              <circle
                cx={s.posX}
                cy={s.posY}
                r={18}
                fill="var(--color-secondary)"
                opacity={0}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onPressStar(s)}
              />
            </g>
          ))}

          {/* Lit stars (3-layer luminous: glow + core + glint). */}
          {litStars.map((s, i) => (
            <LitStar
              key={`lit-${s.id}`}
              star={s}
              index={i}
              reduceMotion={reduceMotion}
              onPress={onPressStar}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
