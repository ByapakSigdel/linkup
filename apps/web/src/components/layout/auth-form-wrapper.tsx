'use client';

import { cn } from '@/lib/cn';
import { LinkupMark, LinkupWordmark } from '@/components/brand/logo';

interface AuthFormWrapperProps {
  title: string;
  description?: string;
  /** Small mono kicker above the title (e.g. "sign in"). */
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}

const mono = { fontFamily: 'var(--font-space-mono), ui-monospace, monospace' };
const serif = { fontFamily: 'var(--font-instrument), Georgia, serif' };

export function AuthFormWrapper({
  title,
  description,
  eyebrow,
  children,
  className,
}: AuthFormWrapperProps) {
  return (
    <div className={cn('lk-anim-rise w-full max-w-md', className)}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface/80 p-8 shadow-[0_28px_64px_-46px_rgba(0,0,0,0.7),0_0_46px_-40px_rgba(196,168,224,0.25)] backdrop-blur-xl">
        {/* Hairline starlight accent across the top edge. */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

        <div className="mb-7">
          <div className="mb-6 flex items-center gap-2.5">
            <LinkupMark size={26} />
            <LinkupWordmark className="text-sm" />
          </div>

          {eyebrow && (
            <p
              className="mb-2 text-[0.65rem] uppercase tracking-[0.32em] text-accent/80"
              style={mono}
            >
              {eyebrow}
            </p>
          )}

          <h1 className="text-3xl leading-tight text-text" style={serif}>
            {title}
          </h1>

          {description && (
            <p className="mt-2 text-sm leading-relaxed text-text-muted">
              {description}
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
