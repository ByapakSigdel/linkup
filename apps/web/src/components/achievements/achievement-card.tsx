'use client';

import { Star } from 'lucide-react';
import { Card, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

export type Rarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface Achievement {
  id: string;
  code: string;
  category: string;
  name: string;
  description: string;
  iconUrl: string; // an emoji
  points: number;
  rarity: Rarity;
  isUnlocked: boolean;
  unlockedAt: string | null;
  isShowcased: boolean;
  currentProgress: number;
  requiredProgress: number;
  percentage: number;
}

/**
 * Rarity badge styling, color-coded per the brand tokens:
 * common = muted/gray, uncommon = success/green, rare = accent/periwinkle,
 * epic = primary/lilac, legendary = secondary/amber.
 */
const RARITY_STYLES: Record<Rarity, { badge: string; ring: string; label: string }> = {
  common: {
    badge: 'bg-surface-active text-text-muted',
    ring: 'border-border',
    label: 'Common',
  },
  uncommon: {
    badge: 'bg-success/15 text-success',
    ring: 'border-success/40',
    label: 'Uncommon',
  },
  rare: {
    badge: 'bg-accent/15 text-accent',
    ring: 'border-accent/40',
    label: 'Rare',
  },
  epic: {
    badge: 'bg-primary/15 text-primary',
    ring: 'border-primary/40',
    label: 'Epic',
  },
  legendary: {
    badge: 'bg-secondary/15 text-secondary',
    ring: 'border-secondary/50',
    label: 'Legendary',
  },
};

interface AchievementCardProps {
  achievement: Achievement;
  onToggleShowcase: (achievement: Achievement) => void;
}

export function AchievementCard({
  achievement,
  onToggleShowcase,
}: AchievementCardProps) {
  const rarity = RARITY_STYLES[achievement.rarity] ?? RARITY_STYLES.common;
  const isLocked = !achievement.isUnlocked;
  const pct = Math.min(
    100,
    Math.max(0, Math.round(achievement.percentage ?? 0)),
  );

  return (
    <Card
      cardStyle="bordered"
      padding="md"
      className={cn(
        'relative flex flex-col gap-3 border transition-all',
        isLocked
          ? 'opacity-60 grayscale'
          : cn('hover:shadow-md', rarity.ring),
        achievement.isShowcased && 'ring-2 ring-secondary/50',
      )}
    >
      {/* Showcase toggle (unlocked only) */}
      {!isLocked && (
        <button
          type="button"
          onClick={() => onToggleShowcase(achievement)}
          aria-pressed={achievement.isShowcased}
          aria-label={
            achievement.isShowcased ? 'Remove from showcase' : 'Showcase'
          }
          title={achievement.isShowcased ? 'Showcased' : 'Showcase'}
          className={cn(
            'absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors',
            achievement.isShowcased
              ? 'bg-secondary/15 text-secondary'
              : 'text-text-muted hover:bg-surface-hover hover:text-text',
          )}
        >
          <Star
            className={cn(
              'h-3.5 w-3.5',
              achievement.isShowcased && 'fill-secondary',
            )}
          />
          <span>{achievement.isShowcased ? 'Showcased' : 'Showcase'}</span>
        </button>
      )}

      {/* Icon */}
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light',
          isLocked && 'bg-surface-active',
        )}
        aria-hidden="true"
      >
        <Emoji emoji={achievement.iconUrl} size={32} />
      </div>

      {/* Name + description */}
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold leading-tight text-text">
          {achievement.name}
        </h3>
        <p className="text-sm text-text-muted">{achievement.description}</p>
      </div>

      {/* Meta row: rarity badge + points */}
      <div className="mt-auto flex items-center justify-between pt-1">
        <span
          className={cn(
            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
            rarity.badge,
          )}
        >
          {rarity.label}
        </span>
        <span className="text-xs font-medium text-text-muted">
          {achievement.points} pts
        </span>
      </div>

      {/* Progress bar (locked only) */}
      {isLocked && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-active">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-text-muted">
            {achievement.currentProgress}/{achievement.requiredProgress} · {pct}%
          </p>
        </div>
      )}
    </Card>
  );
}
