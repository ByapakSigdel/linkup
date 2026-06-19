'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

// Visual identity (radius / shadow / background / border / decoration) is owned
// by the active theme via the `[data-lk="card"]` CSS hooks in globals.css.
// The component only handles layout (text colour + padding).
const cardVariants = cva('text-text transition-all', {
  variants: {
    padding: {
      none: 'p-0',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-8',
    },
  },
  defaultVariants: {
    padding: 'md',
  },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'sticker';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, cardStyle = 'flat', padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-lk="card"
        data-variant={cardStyle}
        className={cn(cardVariants({ padding }), className)}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

// ---- Sub-components ----

const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-display text-lg font-semibold leading-tight tracking-tight text-text',
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-text-muted', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('py-2', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-2 pt-4', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
