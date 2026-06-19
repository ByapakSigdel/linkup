'use client';

// Profile header for a couple's Circle (Instagram-style). Renders the avatar
// (with an optional story-ring slot), @handle, name, bio, and the
// follower/following/post counts. For a non-owner it shows the <FollowButton/>;
// for the owner it shows a privacy badge + an inline public/private toggle and an
// Edit affordance. Built from the GET /circles/:idOrHandle wrapper
// (CircleProfileResponse), where isOwner/followState/canViewPosts are siblings
// of `circle`.

import { useState } from 'react';
import { Globe, Lock, Pencil } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import { FollowButton } from './follow-button';
import type { CircleProfileResponse, FollowState } from './types';

interface ProfileHeaderProps {
  /** Raw GET /circles/:idOrHandle wrapper. */
  profile: CircleProfileResponse;
  /** True when this circle has unseen active stories (drives the ring). */
  hasStories?: boolean;
  /** True when at least one story exists but all are seen (muted ring). */
  storiesSeen?: boolean;
  /** Open the story viewer for this circle (avatar tap when stories exist). */
  onOpenStories?: () => void;
  /** Owner: open the edit-profile flow. */
  onEdit?: () => void;
  /** Bubble follow-state changes up so the page can refetch posts/counts. */
  onFollowChange?: (state: FollowState) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center sm:items-start">
      <span className="font-display text-lg font-semibold leading-none text-text">
        {formatCount(value)}
      </span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

export function ProfileHeader({
  profile,
  hasStories = false,
  storiesSeen = false,
  onOpenStories,
  onEdit,
  onFollowChange,
}: ProfileHeaderProps) {
  const { circle, isOwner, followState } = profile;
  const pushToast = useToastStore((s) => s.push);

  // Owner-side optimistic privacy + live counts.
  const [isPrivate, setIsPrivate] = useState(circle.isPrivate);
  const [followerCount, setFollowerCount] = useState(circle.followerCount);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  const hasRing = hasStories || storiesSeen;
  const ringActive = hasStories; // unseen => bright gradient, seen => muted

  async function togglePrivacy() {
    if (togglingPrivacy) return;
    const next = !isPrivate;
    setIsPrivate(next); // optimistic
    setTogglingPrivacy(true);
    try {
      await circlesApi.updateMyCircle({ isPrivate: next });
      pushToast({
        title: next ? 'Circle set to private' : 'Circle set to public',
        body: next
          ? 'New followers will need to request access.'
          : 'Anyone can now follow and see your posts.',
        variant: 'success',
      });
    } catch {
      setIsPrivate(!next); // rollback
      pushToast({
        title: 'Could not update privacy',
        body: 'Please try again.',
        variant: 'default',
      });
    } finally {
      setTogglingPrivacy(false);
    }
  }

  function handleFollowChange(state: FollowState) {
    // Reflect follower count locally for snappy feedback on public circles.
    setFollowerCount((c) => {
      if (state === 'accepted' && followState !== 'accepted') return c + 1;
      if (state === 'none' && followState === 'accepted')
        return Math.max(c - 1, 0);
      return c;
    });
    onFollowChange?.(state);
  }

  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* Avatar + story-ring slot */}
        <button
          type="button"
          onClick={hasRing ? onOpenStories : undefined}
          disabled={!hasRing}
          aria-label={hasRing ? `View ${circle.name}'s stories` : circle.name}
          className={cn(
            'shrink-0 rounded-full',
            hasRing && 'cursor-pointer',
            !hasRing && 'cursor-default',
          )}
        >
          <span
            className={cn(
              'block rounded-full p-[3px]',
              ringActive &&
                'bg-gradient-to-tr from-primary via-secondary to-primary',
              hasRing && !ringActive && 'bg-border-strong',
              !hasRing && 'bg-transparent',
            )}
          >
            <span className="block rounded-full bg-surface p-[2px]">
              <Avatar
                src={circle.avatarUrl}
                name={circle.name}
                size="xl"
                alt={circle.name}
              />
            </span>
          </span>
        </button>

        {/* Identity + counts */}
        <div className="flex w-full flex-col items-center gap-3 sm:items-start">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
            <h1 className="font-display text-xl font-semibold leading-tight text-text">
              {circle.handle ? `@${circle.handle}` : circle.name}
            </h1>

            {isOwner ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePrivacy}
                  disabled={togglingPrivacy}
                  aria-label={isPrivate ? 'Make circle public' : 'Make circle private'}
                  title={isPrivate ? 'Private — tap to make public' : 'Public — tap to make private'}
                  className="transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  <Badge
                    variant={isPrivate ? 'outline' : 'success'}
                    size="md"
                    className="gap-1"
                  >
                    {isPrivate ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Globe className="h-3 w-3" />
                    )}
                    {isPrivate ? 'Private' : 'Public'}
                  </Badge>
                </button>
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium text-text transition-colors hover:bg-surface-hover"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
            ) : (
              <FollowButton
                idOrHandle={circle.handle ?? circle.id}
                followState={followState}
                isPrivate={isPrivate}
                onStateChange={handleFollowChange}
              />
            )}
          </div>

          {/* Counts */}
          <div className="flex items-center gap-8 sm:gap-10">
            <Stat value={circle.postCount} label="posts" />
            <Stat value={followerCount} label="followers" />
            <Stat value={circle.followingCount} label="following" />
          </div>

          {/* Name + bio */}
          <div className="flex flex-col items-center gap-0.5 text-center sm:items-start sm:text-left">
            {circle.handle && (
              <span className="text-sm font-semibold text-text">
                {circle.name}
              </span>
            )}
            {circle.bio && (
              <p className="max-w-prose whitespace-pre-line text-sm text-text-muted">
                {circle.bio}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
