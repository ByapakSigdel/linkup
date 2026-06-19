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
    stars.push({
      x: +(rand() * 100).toFixed(2),
      y: +(rand() * 100).toFixed(2),
      // Mostly faint dust, a few brighter stars.
      r: +(0.4 + r * r * 1.9).toFixed(2),
      o: +(0.25 + rand() * 0.6).toFixed(2),
      dur: +(2.6 + rand() * 4).toFixed(2),
      delay: +(rand() * 5).toFixed(2),
    });
  }
  return stars;
}

const STARS = buildStars(90, 0x5eed1e);

/** RA/Dec-style coordinate lines (percentages of the viewport). */
const V_LINES = [16, 33, 50, 67, 84];
const H_LINES = [22, 44, 66, 88];

export function ConstellationSky({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 overflow-hidden', className)}
      style={{ background: '#080b12' }}
    >
      {/* Deep-space depth: a high cool wash + faint lilac nebula off-axis. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 78% -10%, rgba(168,191,212,0.10), transparent 55%),' +
            'radial-gradient(90% 70% at 12% 8%, rgba(196,168,224,0.08), transparent 50%)',
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
            stroke="#a8bfd4"
            strokeWidth="0.5"
            strokeOpacity="0.06"
          />
        ))}
        {H_LINES.map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            y1={`${y}%`}
            x2="100%"
            y2={`${y}%`}
            stroke="#a8bfd4"
            strokeWidth="0.5"
            strokeOpacity="0.06"
          />
        ))}
      </svg>

      {/* Star field */}
      <div className="absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="lk-twinkle absolute rounded-full bg-[#e8e4dc]"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.r}px`,
              height: `${s.r}px`,
              opacity: s.o,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
              boxShadow: s.r > 1.6 ? '0 0 6px 1px rgba(232,228,220,0.5)' : undefined,
            }}
          />
        ))}
      </div>

      {/* Pre-dawn glow at the horizon — periwinkle warming toward amber. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42vh]"
        style={{
          background:
            'radial-gradient(120% 100% at 50% 145%, rgba(212,165,116,0.14) 0%, rgba(168,191,212,0.10) 30%, transparent 62%)',
        }}
      />
    </div>
  );
}
