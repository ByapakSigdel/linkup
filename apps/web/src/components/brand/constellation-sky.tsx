import { cn } from '@/lib/cn';

/**
 * The midnight-constellation backdrop shared by LinkUp's front door (landing +
 * auth). A real star-chart feel: deep-space gradient, a faint RA/Dec graticule,
 * a pre-dawn glow at the horizon ("the hours between midnight and dawn"), and a
 * field of quietly twinkling stars.
 *
 * Star positions are generated from a fixed seed so the server and client render
 * identical markup (no hydration mismatch) — there is no client state here, so
 * this stays a server component.
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

export function ConstellationSky({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}
      style={{ background: '#14171f' }}
    >
      {/* Deep-space depth: a soft cool wash + faint lilac nebula off-axis. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 78% -10%, rgba(174,197,216,0.06), transparent 55%),' +
            'radial-gradient(90% 70% at 12% 8%, rgba(196,168,224,0.05), transparent 50%)',
        }}
      />

      {/* Coordinate graticule — a real star-chart layer, faded to the centre. */}
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        style={{
          maskImage:
            'radial-gradient(120% 120% at 50% 45%, transparent 38%, black 100%)',
          WebkitMaskImage:
            'radial-gradient(120% 120% at 50% 45%, transparent 38%, black 100%)',
        }}
      >
        {V_LINES.map((x) => (
          <line
            key={`v${x}`}
            x1={`${x}%`}
            y1="0"
            x2={`${x}%`}
            y2="100%"
            stroke="#aec5d8"
            strokeWidth="0.5"
            strokeOpacity="0.035"
          />
        ))}
        {H_LINES.map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            y1={`${y}%`}
            x2="100%"
            y2={`${y}%`}
            stroke="#aec5d8"
            strokeWidth="0.5"
            strokeOpacity="0.035"
          />
        ))}
      </svg>

      {/* Star field — dim, mostly steady, a third gently breathing; the whole
          field drifts almost imperceptibly for depth. */}
      <div className="lk-float absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className={cn('absolute rounded-full bg-[#dcd8cf]', s.tw && 'lk-glimmer')}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.r}px`,
              height: `${s.r}px`,
              opacity: s.o,
              ...(s.tw
                ? {
                    ['--lk-o' as string]: `${s.o}`,
                    ['--lk-o-hi' as string]: `${s.oHi}`,
                    animationDuration: `${s.dur}s`,
                    animationDelay: `${s.delay}s`,
                  }
                : {}),
            }}
          />
        ))}
      </div>

      {/* Shooting stars — sporadic, faint streaks. */}
      {[
        { top: '12%', left: '8%', r: '24deg', d: '560px', dur: '11s', delay: '3s', w: '160px' },
        { top: '6%', left: '54%', r: '32deg', d: '440px', dur: '14s', delay: '8s', w: '120px' },
        { top: '30%', left: '70%', r: '18deg', d: '600px', dur: '17s', delay: '13s', w: '180px' },
      ].map((m, i) => (
        <span
          key={i}
          className="lk-shoot"
          style={{
            top: m.top,
            left: m.left,
            width: m.w,
            animationDuration: m.dur,
            animationDelay: m.delay,
            ['--r' as string]: m.r,
            ['--d' as string]: m.d,
          }}
        />
      ))}

      {/* Pre-dawn glow at the horizon — periwinkle warming toward amber. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42vh]"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 150%, rgba(212,165,116,0.09) 0%, rgba(174,197,216,0.06) 32%, transparent 62%)',
        }}
      />
    </div>
  );
}
