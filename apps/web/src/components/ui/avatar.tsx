'use client';

import { forwardRef, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';
import { getInitials } from '@linkup/utils';

const avatarVariants = cva(
  'relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-primary-light text-primary font-medium select-none',
  {
    variants: {
      shape: {
        circle: 'rounded-full',
        squircle: 'rounded-[22%]',
        hexagon: '[clip-path:polygon(50%_0%,100%_25%,100%_75%,50%_100%,0%_75%,0%_25%)]',
        organic: 'rounded-[30%_70%_70%_30%/30%_30%_70%_70%]',
      },
      size: {
        xs: 'h-6 w-6 text-[10px]',
        sm: 'h-8 w-8 text-xs',
        md: 'h-10 w-10 text-sm',
        lg: 'h-14 w-14 text-lg',
        xl: 'h-20 w-20 text-2xl',
      },
    },
    defaultVariants: {
      shape: 'circle',
      size: 'md',
    },
  },
);

const statusDotSizeMap = {
  xs: 'h-1.5 w-1.5 border',
  sm: 'h-2 w-2 border-[1.5px]',
  md: 'h-2.5 w-2.5 border-2',
  lg: 'h-3 w-3 border-2',
  xl: 'h-4 w-4 border-2',
} as const;

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  /** Image source URL */
  src?: string | null;
  /** Alt text for the image */
  alt?: string;
  /** Display name used for fallback initials */
  name?: string;
  /** Show an online status indicator */
  status?: 'online' | 'offline' | 'away' | 'busy';
}

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, shape, size, src, alt, name, status, ...props }, ref) => {
    const [imgError, setImgError] = useState(false);
    const showImage = src && !imgError;
    const sizeKey = size ?? 'md';

    return (
      <span
        ref={ref}
        className={cn(avatarVariants({ shape, size }), className)}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span aria-hidden="true">
            {name ? getInitials(name) : '?'}
          </span>
        )}

        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-surface',
              statusDotSizeMap[sizeKey],
              {
                'bg-success': status === 'online',
                'bg-text-muted': status === 'offline',
                'bg-warning': status === 'away',
                'bg-error': status === 'busy',
              },
            )}
            aria-label={`Status: ${status}`}
          />
        )}
      </span>
    );
  },
);

Avatar.displayName = 'Avatar';

export { Avatar, avatarVariants };
