'use client';

import Link from 'next/link';
import { Users, MessageSquare, Shield } from 'lucide-react';
import { Card, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { CircleListItem } from './types';

interface CircleCardProps {
  circle: CircleListItem;
}

export function CircleCard({ circle }: CircleCardProps) {
  const initial = circle.name?.trim()?.charAt(0)?.toUpperCase() || '?';

  return (
    <Link href={`/circles/${circle.id}`} className="group block">
      <Card
        cardStyle="bordered"
        padding="none"
        className="overflow-hidden transition-all group-hover:border-border-focus group-hover:shadow-md"
      >
        {/* Cover */}
        <div className="relative h-24 w-full overflow-hidden bg-primary-light">
          {circle.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={circle.coverImageUrl}
              alt={circle.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-display text-4xl font-bold text-primary/70">
                {initial}
              </span>
            </div>
          )}
          {circle.isAdmin && (
            <Badge
              variant="default"
              size="sm"
              className="absolute right-2 top-2 gap-1"
            >
              <Shield className="h-3 w-3" />
              Admin
            </Badge>
          )}
        </div>

        {/* Body */}
        <div className="space-y-2 p-4">
          <h3 className="truncate font-display text-base font-semibold text-text">
            {circle.name}
          </h3>
          <p
            className={cn(
              'text-sm text-text-muted',
              circle.description ? 'line-clamp-2' : 'italic',
            )}
          >
            {circle.description || 'No description yet'}
          </p>
          <div className="flex items-center gap-4 pt-1 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span className="font-mono">{circle.memberCount}</span> member
              {circle.memberCount !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="font-mono">{circle.postCount}</span> post
              {circle.postCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
