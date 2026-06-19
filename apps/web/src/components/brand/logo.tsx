import { cn } from '@/lib/cn';

/**
 * The LinkUp constellation mark: two stars (amber + starlight) joined by a
 * periwinkle bond line, with a lilac "link point" sparkle at the centre.
 */
export function LinkupMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* bond line */}
      <line
        x1="12"
        y1="32"
        x2="37"
        y2="15"
        stroke="#A8BFD4"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* large star (amber) */}
      <circle cx="12" cy="32" r="5.2" fill="#D4A574" />
      {/* small star (starlight) */}
      <circle cx="37" cy="15" r="3.6" fill="#E8E4DC" />
      {/* link point — lilac sparkle */}
      <path
        d="M24.5 18.2c.4 2.6 1.2 3.4 3.8 3.8-2.6.4-3.4 1.2-3.8 3.8-.4-2.6-1.2-3.4-3.8-3.8 2.6-.4 3.4-1.2 3.8-3.8Z"
        fill="#C4A8E0"
      />
    </svg>
  );
}

/** Lowercase, wide-tracked wordmark. */
export function LinkupWordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      className={cn(
        'font-light lowercase tracking-[0.32em] text-text select-none',
        className,
      )}
    >
      linkup
    </span>
  );
}

/** Combined lockup: mark + wordmark. */
export function Logo({
  className,
  markSize = 28,
  wordmarkClassName,
}: {
  className?: string;
  markSize?: number;
  wordmarkClassName?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LinkupMark size={markSize} />
      <LinkupWordmark className={wordmarkClassName} />
    </div>
  );
}
