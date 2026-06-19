import { cn } from '@/lib/cn';

/**
 * The hero figure of LinkUp's front door: two stars — a couple — plotted on the
 * sky and joined by a bond line that draws itself in, with a lilac "link point"
 * igniting between them. It is the logo mark told at full scale. Pure CSS
 * animation (see globals.css `.lk-anim-*`); reduced motion shows the final
 * state immediately.
 */
export function ConstellationOfTwo({ className }: { className?: string }) {
  const mono = { fontFamily: 'var(--font-space-mono), ui-monospace, monospace' };

  return (
    <svg
      viewBox="0 0 420 380"
      fill="none"
      role="img"
      aria-label="Two stars joined by a bond line — a constellation of two"
      className={cn('h-full w-full', className)}
    >
      {/* Faint orbit the pair share — drifts gently. */}
      <g className="lk-drift">
        <ellipse
          cx="215"
          cy="185"
          rx="158"
          ry="118"
          stroke="#a8bfd4"
          strokeWidth="0.75"
          strokeOpacity="0.16"
          strokeDasharray="2 7"
        />
      </g>

      {/* Companion stars + a thin asterism, so the pair reads as a constellation. */}
      <g className="lk-anim-fade" style={{ animationDelay: '0.9s' }}>
        <line x1="60" y1="92" x2="120" y2="250" stroke="#a8bfd4" strokeWidth="0.5" strokeOpacity="0.12" />
        <line x1="310" y1="120" x2="372" y2="206" stroke="#a8bfd4" strokeWidth="0.5" strokeOpacity="0.12" />
        {[
          [60, 92, 1.6],
          [200, 44, 1.3],
          [372, 206, 1.8],
          [330, 318, 1.2],
          [44, 300, 1.4],
        ].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="#e8e4dc" fillOpacity="0.5" />
        ))}
      </g>

      {/* Bond line — draws on. */}
      <line
        x1="120"
        y1="250"
        x2="310"
        y2="120"
        stroke="#a8bfd4"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="lk-anim-line"
        style={{ ['--lk-dash' as string]: '240' }}
      />

      {/* Large star — amber. */}
      <g className="lk-anim-pop" style={{ animationDelay: '0.5s' }}>
        <circle cx="120" cy="250" r="22" fill="#d4a574" fillOpacity="0.12" />
        <circle cx="120" cy="250" r="11.5" fill="#d4a574" />
      </g>

      {/* Small star — starlight. */}
      <g className="lk-anim-pop" style={{ animationDelay: '0.95s' }}>
        <circle cx="310" cy="120" r="15" fill="#e8e4dc" fillOpacity="0.12" />
        <circle cx="310" cy="120" r="7" fill="#e8e4dc" />
      </g>

      {/* Link point — lilac sparkle igniting at the midpoint of the bond. */}
      <path
        d="M0,-15 C1.6,-4.2 4.2,-1.6 15,0 C4.2,1.6 1.6,4.2 0,15 C-1.6,4.2 -4.2,1.6 -15,0 C-4.2,-1.6 -1.6,-4.2 0,-15 Z"
        transform="translate(215 185)"
        fill="#c4a8e0"
        className="lk-anim-ignite"
      />

      {/* Star-chart coordinate tags. */}
      <g
        className="lk-anim-fade"
        style={{ animationDelay: '2s', ...mono }}
        fill="#8a93a8"
      >
        <text x="120" y="284" textAnchor="middle" fontSize="9.5" letterSpacing="1">
          21ʰ 14ᵐ
        </text>
        <text x="310" y="100" textAnchor="middle" fontSize="9.5" letterSpacing="1">
          +38° 47′
        </text>
      </g>
    </svg>
  );
}
