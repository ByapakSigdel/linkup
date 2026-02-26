'use client';

import { Heart } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';

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
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-12">
      <Card
        cardStyle="bordered"
        padding="lg"
        className={cn('w-full max-w-md', className)}
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text">
            {title}
          </h1>
          {description && (
            <p className="text-center text-sm text-text-muted">{description}</p>
          )}
        </div>
        {children}
      </Card>
    </div>
  );
}
