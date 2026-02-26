'use client';

import { forwardRef, useId } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const inputVariants = cva(
  'w-full bg-transparent text-text placeholder:text-text-muted transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      inputStyle: {
        outlined:
          'border border-border rounded-lg px-3 focus:border-border-focus focus:ring-2 focus:ring-border-focus/20',
        filled:
          'bg-surface-hover border border-transparent rounded-lg px-3 focus:bg-surface focus:border-border-focus focus:ring-2 focus:ring-border-focus/20',
        underline:
          'border-b-2 border-border rounded-none px-1 focus:border-border-focus',
        rounded:
          'border border-border rounded-full px-4 focus:border-border-focus focus:ring-2 focus:ring-border-focus/20',
      },
      size: {
        sm: 'h-8 text-xs',
        md: 'h-10 text-sm',
        lg: 'h-12 text-base',
      },
    },
    defaultVariants: {
      inputStyle: 'outlined',
      size: 'md',
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (hidden when error is shown) */
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inputStyle, size, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText && !error ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            inputVariants({ inputStyle, size }),
            error && 'border-error focus:border-error focus:ring-error/20',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId || helperId || undefined}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-error" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export { Input, inputVariants };
