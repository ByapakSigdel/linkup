'use client';

import { cn } from '@/lib/cn';

interface TypingIndicatorProps {
  partnerName?: string;
  className?: string;
}

export function TypingIndicator({ partnerName, className }: TypingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 px-4 py-2', className)}>
      {/* Animated dots */}
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-[typing_1.4s_infinite_0ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-[typing_1.4s_infinite_200ms]" />
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-[typing_1.4s_infinite_400ms]" />
      </div>
      <span className="text-xs font-medium text-text-muted">
        {partnerName ? `${partnerName} is typing…` : 'Typing…'}
      </span>
    </div>
  );
}
