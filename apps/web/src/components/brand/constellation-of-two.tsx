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
      {/* Faint orbit the pair share — drifts gently while its dashes flow. */}
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
          className="lk-orbit-flow"
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

      {/* Large star — amber, with a breathing glow. */}
      <circle cx="120" cy="250" r="20" fill="#d4a574" className="lk-pulse-glow" />
      <g className="lk-anim-pop" style={{ animationDelay: '0.5s' }}>
        <circle cx="120" cy="250" r="11" fill="#cfa170" />
      </g>

      {/* Small star — starlight, with a breathing glow. */}
      <circle
        cx="310"
        cy="120"
        r="14"
        fill="#e8e4dc"
        className="lk-pulse-glow"
        style={{ animationDelay: '1.4s' }}
      />
      <g className="lk-anim-pop" style={{ animationDelay: '0.95s' }}>
        <circle cx="310" cy="120" r="6.5" fill="#ddd8cf" />
      </g>

      {/* Link point — lilac sparkle igniting at the midpoint of the bond.
          Translate lives on the group (an SVG attribute) so the path's CSS
          scale animation doesn't override its position. */}
      <g transform="translate(215 185)">
        <circle r="13" fill="#c4a8e0" className="lk-pulse-glow" style={{ animationDelay: '2.4s' }} />
        <g className="lk-sparkle-pulse">
          <path
            d="M0,-15 C1.6,-4.2 4.2,-1.6 15,0 C4.2,1.6 1.6,4.2 0,15 C-1.6,4.2 -4.2,1.6 -15,0 C-4.2,-1.6 -1.6,-4.2 0,-15 Z"
            fill="#c4a8e0"
            className="lk-anim-ignite"
          />
        </g>
      </g>

      {/* Star-chart coordinate tags. */}
      <g
        className="lk-anim-fade"
        style={{ animationDelay: '2s', ...mono }}
        fill="#9aa3b4"
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
