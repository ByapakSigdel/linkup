'use client';

// CircleCard — a single result row for the Discover grid and the Following /
// Followers lists. Shows the couple's avatar, @handle, display name, follower
// count (when known), and an embedded FollowButton.
//
// It accepts BOTH shapes returned by the API:
//   • CircleProfile  (GET /circles/discover) — rich: followerCount, isPrivate, isOwner
//   • CircleSummary  (GET /circles/me/following | /followers) — light: id/handle/name/avatar
// Anything missing simply isn't rendered.

import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { FollowButton } from './follow-button';
import type { CircleProfile, CircleSummary, FollowState } from './types';

export interface CircleCardProps {
  circle: CircleProfile | CircleSummary;
  /** Hide the embedded FollowButton (e.g. simple list display). */
  hideFollow?: boolean;
  /** Bubble follow-state changes up so a parent list can re-sync. */
  onFollowChange?: (id: string, state: FollowState) => void;
  className?: string;
}

function hasProfileFields(c: CircleProfile | CircleSummary): c is CircleProfile {
  return 'followerCount' in c;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export function CircleCard({
  circle,
  hideFollow = false,
  onFollowChange,
  className,
}: CircleCardProps) {
  const profile = hasProfileFields(circle) ? circle : null;
  const followState: FollowState = circle.followState ?? 'none';
  const isPrivate = profile?.isPrivate ?? false;
  const isOwner = profile?.isOwner ?? false;

  // Link by handle when present (prettier URLs), else by id.
  const href = `/circles/${encodeURIComponent(circle.handle ?? circle.id)}`;
  const displayHandle = circle.handle ? `@${circle.handle}` : null;
  const followerCount = profile?.followerCount;

  return (
    <div
      data-lk="card"
      data-variant="bordered"
      className={cn(
        'flex items-center gap-3 p-3 transition-all hover:border-border-focus hover:shadow-sm',
        className,
      )}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-[var(--lk-btn-radius)]"
      >
        <Avatar
          src={circle.avatarUrl}
          name={circle.name}
          size="lg"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-display text-sm font-semibold text-text">
              {circle.name}
            </span>
            {isPrivate && (
              <Lock
                className="h-3.5 w-3.5 shrink-0 text-text-muted"
                aria-label="Private circle"
              />
            )}
          </div>

          {displayHandle && (
            <p className="truncate text-xs text-text-muted">{displayHandle}</p>
          )}

          {followerCount != null && (
            <p className="mt-0.5 text-xs text-text-muted">
              <span className="font-medium text-text">{formatCount(followerCount)}</span>{' '}
              {followerCount === 1 ? 'follower' : 'followers'}
            </p>
          )}
        </div>
      </Link>

      {!hideFollow && !isOwner && (
        <FollowButton
          idOrHandle={circle.handle ?? circle.id}
          followState={followState}
          isPrivate={isPrivate}
          isOwner={isOwner}
          size="sm"
          onStateChange={(s) => onFollowChange?.(circle.id, s)}
          className="shrink-0"
        />
      )}
    </div>
  );
}
