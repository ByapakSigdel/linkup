'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Flame,
  Snowflake,
  RotateCcw,
  Camera,
  Trophy,
  Clock,
  TrendingUp,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useStreaksStore } from '@/stores/streaks-store';
import { Card, CardHeader, CardTitle, CardContent, Button, Spinner, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';

const MILESTONE_LABELS: Record<number, string> = {
  7: 'One Week',
  30: 'One Month',
  100: 'Century',
  365: 'Full Year',
};

export default function StreaksPage() {
  const couple = useAuthStore((s) => s.couple);
  const {
    streak,
    history,
    isLoading,
    isContributing,
    error,
    fetchStreak,
    contributePhoto,
    freezeStreak,
    recoverStreak,
    fetchHistory,
  } = useStreaksStore();

  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);

  useEffect(() => {
    fetchStreak();
    fetchHistory();
  }, [fetchStreak, fetchHistory]);

  const handleContribute = useCallback(async () => {
    // In a real app, this would open the media picker and upload a photo first.
    // For now, we create a placeholder photo ID.
    const photoId = crypto.randomUUID();
    const result = await contributePhoto(photoId);
    if (result?.milestoneReached) {
      const label = MILESTONE_LABELS[result.milestoneReached] ?? `${result.milestoneReached} days`;
      setMilestoneToast(`Milestone reached: ${label}!`);
      setTimeout(() => setMilestoneToast(null), 4000);
    }
  }, [contributePhoto]);

  // Calculate hours remaining until midnight
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const msRemaining = midnight.getTime() - now.getTime();
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor(
    (msRemaining % (1000 * 60 * 60)) / (1000 * 60),
  );

  const today = new Date().toISOString().split('T')[0];
  const hasContributedToday = streak?.lastPhotoDate === today;

  if (isLoading && !streak) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Milestone toast */}
      {milestoneToast && (
        <div className="achievement-toast fixed top-4 right-4 z-50 rounded-xl bg-accent px-6 py-4 text-text-on-primary shadow-lg">
          <div className="flex items-center gap-3">
            <Emoji emoji="🏆" size={24} />
            <span className="font-semibold">{milestoneToast}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Daily Ritual
        </p>
        <h1 className="font-display text-2xl font-bold text-text">
          Photo Streak
        </h1>
        <p className="text-text-muted">
          Share a photo with your partner every day to keep the streak alive
        </p>
      </div>

      {/* Current Streak Card */}
      <Card cardStyle="elevated" padding="lg">
        <div className="flex flex-col items-center text-center">
          {/* Flame icon with streak */}
          <div className="relative mb-4">
            <div
              className={cn(
                'flex h-28 w-28 items-center justify-center rounded-full',
                streak && streak.currentStreak > 0
                  ? 'bg-gradient-to-br from-accent to-primary'
                  : 'bg-surface-hover',
              )}
            >
              <Flame
                className={cn(
                  'h-14 w-14',
                  streak && streak.currentStreak > 0
                    ? 'streak-flame text-text-on-primary'
                    : 'text-text-muted',
                )}
              />
            </div>
            {streak?.status === 'frozen' && (
              <div className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full bg-info text-text-on-primary shadow-md">
                <Snowflake className="h-5 w-5" />
              </div>
            )}
          </div>

          <span className="font-mono text-5xl font-bold tabular-nums text-text">
            {streak?.currentStreak ?? 0}
          </span>
          <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            {(streak?.currentStreak ?? 0) === 1 ? 'Day' : 'Days'} Streak
          </p>

          {streak?.status === 'frozen' && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-info/10 px-3 py-1 text-xs font-medium text-info">
              <Snowflake className="h-3 w-3" /> Frozen
            </span>
          )}
        </div>
      </Card>

      {/* Action Area */}
      <Card cardStyle="bordered" padding="md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {hasContributedToday ? (
              <div className="flex items-center gap-2 text-success">
                <Camera className="h-5 w-5" />
                <span className="font-medium">Photo shared today</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-text-muted">
                <Clock className="h-5 w-5" />
                <span>
                  <span className="font-mono tabular-nums">
                    {hoursRemaining}h {minutesRemaining}m
                  </span>{' '}
                  remaining
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {!hasContributedToday && (
              <Button
                onClick={handleContribute}
                disabled={isContributing}
                variant="primary"
                size="md"
              >
                {isContributing ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Share Photo
                  </>
                )}
              </Button>
            )}

            {streak &&
              streak.currentStreak > 0 &&
              streak.status !== 'frozen' &&
              streak.freezesAvailable > 0 && (
                <Button onClick={freezeStreak} variant="outline" size="md">
                  <Snowflake className="mr-2 h-4 w-4" />
                  Freeze (<span className="font-mono tabular-nums">{streak.freezesAvailable}</span>)
                </Button>
              )}

            {streak?.canRecover && (
              <Button onClick={recoverStreak} variant="secondary" size="md">
                <RotateCcw className="mr-2 h-4 w-4" />
                Recover
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-error">{error}</p>
        )}
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card cardStyle="bordered" padding="sm">
          <div className="flex flex-col items-center gap-1 py-2 text-center">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-mono text-2xl font-bold tabular-nums text-text">
              {streak?.longestStreak ?? 0}
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Longest Streak</span>
          </div>
        </Card>
        <Card cardStyle="bordered" padding="sm">
          <div className="flex flex-col items-center gap-1 py-2 text-center">
            <Camera className="h-5 w-5 text-secondary" />
            <span className="font-mono text-2xl font-bold tabular-nums text-text">
              {streak?.totalPhotos ?? 0}
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Total Photos</span>
          </div>
        </Card>
        <Card cardStyle="bordered" padding="sm">
          <div className="flex flex-col items-center gap-1 py-2 text-center">
            <Star className="h-5 w-5 text-accent" />
            <span className="font-mono text-2xl font-bold tabular-nums text-text">
              {streak?.totalPoints ?? 0}
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Total Points</span>
          </div>
        </Card>
        <Card cardStyle="bordered" padding="sm">
          <div className="flex flex-col items-center gap-1 py-2 text-center">
            <Snowflake className="h-5 w-5 text-info" />
            <span className="font-mono text-2xl font-bold tabular-nums text-text">
              {streak?.freezesAvailable ?? 0}
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-text-muted">Freezes Left</span>
          </div>
        </Card>
      </div>

      {/* Milestones */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(MILESTONE_LABELS).map(([days, label]) => {
              const daysNum = parseInt(days, 10);
              const achieved = (streak?.longestStreak ?? 0) >= daysNum;
              return (
                <div
                  key={days}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    achieved
                      ? 'bg-primary text-text-on-primary'
                      : 'bg-surface-hover text-text-muted',
                  )}
                >
                  <Emoji emoji={achieved ? '🏆' : '🔒'} size={16} />
                  <span>{label}</span>
                  <span className="font-mono tabular-nums opacity-70">({days}d)</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle>Streak History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-4 text-center text-text-muted">
              No streak history yet. Start sharing photos!
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-text-on-primary',
                        entry.eventType === 'photo_added' && 'bg-success',
                        entry.eventType === 'milestone' && 'bg-accent',
                        entry.eventType === 'streak_broken' && 'bg-error',
                        entry.eventType === 'streak_frozen' && 'bg-info',
                        entry.eventType === 'streak_recovered' && 'bg-secondary',
                      )}
                    >
                      {entry.eventType === 'photo_added' && (
                        <Camera className="h-4 w-4" />
                      )}
                      {entry.eventType === 'milestone' && (
                        <Trophy className="h-4 w-4" />
                      )}
                      {entry.eventType === 'streak_broken' && (
                        <Flame className="h-4 w-4" />
                      )}
                      {entry.eventType === 'streak_frozen' && (
                        <Snowflake className="h-4 w-4" />
                      )}
                      {entry.eventType === 'streak_recovered' && (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">
                        {entry.eventType === 'photo_added' && 'Photo shared'}
                        {entry.eventType === 'milestone' && 'Milestone reached'}
                        {entry.eventType === 'streak_broken' && 'Streak broken'}
                        {entry.eventType === 'streak_frozen' && 'Streak frozen'}
                        {entry.eventType === 'streak_recovered' && 'Streak recovered'}
                      </p>
                      <p className="text-xs text-text-muted">
                        Day <span className="font-mono tabular-nums">{entry.streakLength}</span>
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
