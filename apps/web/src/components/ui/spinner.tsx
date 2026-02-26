'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const spinnerVariants = cva(
  'animate-spin inline-block border-current border-t-transparent rounded-full',
  {
    variants: {
      size: {
        sm: 'h-4 w-4 border-2',
        md: 'h-6 w-6 border-2',
        lg: 'h-8 w-8 border-[3px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof spinnerVariants> {}

export function Spinner({ className, size, ...props }: SpinnerProps) {
  return (
    <span role="status" aria-label="Loading" {...props}>
      <span className={cn(spinnerVariants({ size }), className)} />
      <span className="sr-only">Loading...</span>
    </span>
  );
}

export { spinnerVariants };
