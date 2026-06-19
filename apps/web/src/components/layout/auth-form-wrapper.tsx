'use client';

import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LinkupMark, LinkupWordmark } from '@/components/brand/logo';

interface AuthFormWrapperProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthFormWrapper({
  title,
  description,
  children,
  className,
}: AuthFormWrapperProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-12">
      <Card
        cardStyle="bordered"
        padding="lg"
        className={cn('relative z-10 w-full max-w-md', className)}
      >
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2.5">
            <LinkupMark size={34} />
            <LinkupWordmark className="text-lg" />
          </div>
          <div className="mt-2 flex flex-col items-center gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              {title}
            </h1>
            {description && (
              <p className="text-center text-sm text-text-muted">
                {description}
              </p>
            )}
          </div>
        </div>
        {children}
      </Card>
    </div>
  );
}
