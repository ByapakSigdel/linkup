'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-text-on-primary hover:bg-primary-hover shadow-sm hover:shadow-md active:shadow-sm',
        secondary:
          'bg-secondary text-text-on-primary hover:bg-secondary-hover shadow-sm hover:shadow-md active:shadow-sm',
        outline:
          'border border-border-strong bg-transparent text-text hover:bg-surface-hover hover:border-border-focus',
        ghost:
          'bg-transparent text-text hover:bg-surface-hover active:bg-surface-active',
        destructive:
          'bg-error text-white hover:bg-error/90 shadow-sm hover:shadow-md active:shadow-sm',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
      shape: {
        rounded: 'rounded-[var(--lk-btn-radius)]',
        pill: 'rounded-full',
        square: 'rounded-none',
        organic: 'rounded-[1.25rem_0.5rem_1.25rem_0.5rem]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      shape: 'rounded',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Show a loading spinner and disable the button */
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-lk="button"
        data-variant={variant ?? 'primary'}
        className={cn(buttonVariants({ variant, size, shape }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size={size === 'lg' ? 'md' : 'sm'} />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button, buttonVariants };
