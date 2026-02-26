'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-text-on-primary',
        secondary: 'bg-secondary text-text-on-primary',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        error: 'bg-error/15 text-error',
        outline: 'bg-transparent text-text border border-border-strong',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px] rounded-md',
        md: 'px-2.5 py-0.5 text-xs rounded-md',
        lg: 'px-3 py-1 text-sm rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants };
