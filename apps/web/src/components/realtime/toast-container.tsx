'use client';

import { X } from 'lucide-react';
import { Emoji } from '@/components/ui';
import { useToastStore } from '@/stores/toast-store';
import { cn } from '@/lib/cn';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface p-3 shadow-lg animate-in slide-in-from-right',
            t.variant === 'achievement'
              ? 'border-secondary/40 bg-secondary/5'
              : t.variant === 'success'
                ? 'border-success/40'
                : 'border-border',
          )}
        >
          {t.icon && (
            <span className="leading-none" aria-hidden>
              <Emoji emoji={t.icon} size={22} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">{t.title}</p>
            {t.body && (
              <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">
                {t.body}
              </p>
            )}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
