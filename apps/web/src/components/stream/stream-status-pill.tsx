'use client';

import { cn } from '@/lib/cn';
import type { StreamPhase } from './use-live-stream';

const LABELS: Record<StreamPhase, string> = {
  idle: 'Ready',
  broadcasting: "You're live",
  watching: 'Watching partner',
  'partner-live': 'Partner is live',
};

/**
 * A small floating status pill that reflects the current stream phase.
 * A soft pulsing dot signals an active live session.
 */
export function StreamStatusPill({
  phase,
  className,
}: {
  phase: StreamPhase;
  className?: string;
}) {
  const live = phase === 'broadcasting' || phase === 'watching';
  const pending = phase === 'partner-live';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm',
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {(live || pending) && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              live ? 'bg-secondary' : 'bg-accent',
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            live ? 'bg-secondary' : pending ? 'bg-accent' : 'bg-text-muted',
          )}
        />
      </span>
      {LABELS[phase]}
    </div>
  );
}
