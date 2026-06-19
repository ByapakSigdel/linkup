'use client';

import { useCallback, useEffect, useState } from 'react';
import { Trophy, Sparkles, Star } from 'lucide-react';
import { Card, Spinner } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import {
  AchievementCard,
  type Achievement,
} from './achievement-card';

interface AchievementStats {
  totalAvailable: number;
  totalUnlocked: number;
  totalPoints: number;
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'communication', label: 'Communication' },
  { value: 'memories', label: 'Memories' },
  { value: 'streaks', label: 'Streaks' },
  { value: 'time_based', label: 'Time' },
  { value: 'creative', label: 'Creative' },
  { value: 'social', label: 'Social' },
] as const;

export function AchievementsTab() {
  const push = useToastStore((s) => s.push);

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats>({
    totalAvailable: 0,
    totalUnlocked: 0,
    totalPoints: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchAchievements = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/achievements');
      setAchievements(data.data?.achievements ?? []);
      setStats(
        data.data?.stats ?? {
          totalAvailable: 0,
          totalUnlocked: 0,
          totalPoints: 0,
        },
      );
    } catch {
      // Silently fail — empty state will render.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const handleToggleShowcase = useCallback(
    async (achievement: Achievement) => {
      const nextValue = !achievement.isShowcased;

      // Optimistic update.
      setAchievements((prev) =>
        prev.map((a) =>
          a.id === achievement.id ? { ...a, isShowcased: nextValue } : a,
        ),
      );

      try {
        const { data } = await api.post(
          `/achievements/${achievement.id}/showcase`,
        );
        const confirmed = data.data?.isShowcased ?? nextValue;
        setAchievements((prev) =>
          prev.map((a) =>
            a.id === achievement.id ? { ...a, isShowcased: confirmed } : a,
          ),
        );
        push({
          title: confirmed ? 'Added to showcase' : 'Removed from showcase',
          icon: achievement.iconUrl,
          variant: 'achievement',
        });
      } catch (err) {
        // Roll back on failure.
        setAchievements((prev) =>
          prev.map((a) =>
            a.id === achievement.id
              ? { ...a, isShowcased: achievement.isShowcased }
              : a,
          ),
        );
        const e = err as {
          response?: { data?: { error?: { message?: string } } };
        };
        push({
          title: 'Could not update showcase',
          body: e.response?.data?.error?.message,
          variant: 'default',
        });
      }
    },
    [push],
  );

  const filtered =
    activeCategory === 'all'
      ? achievements
      : achievements.filter((a) => a.category === activeCategory);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card cardStyle="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-text">
                {stats.totalUnlocked}
                <span className="text-sm font-normal text-text-muted">
                  {' '}
                  / {stats.totalAvailable}
                </span>
              </p>
              <p className="text-xs text-text-muted">Unlocked</p>
            </div>
          </div>
        </Card>

        <Card cardStyle="bordered" padding="md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <Star className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <p className="text-xl font-bold text-text">{stats.totalPoints}</p>
              <p className="text-xs text-text-muted">Total points</p>
            </div>
          </div>
        </Card>

        <Card
          cardStyle="bordered"
          padding="md"
          className="col-span-2 sm:col-span-1"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-xl font-bold text-text">
                {stats.totalAvailable > 0
                  ? Math.round(
                      (stats.totalUnlocked / stats.totalAvailable) * 100,
                    )
                  : 0}
                %
              </p>
              <p className="text-xs text-text-muted">Completion</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Category filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-text-on-primary shadow-sm'
                  : 'bg-surface-hover text-text-muted hover:text-text',
              )}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Grid / empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <LinkupMark size={48} className="opacity-80" />
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text">
              No achievements here yet
            </h3>
            <p className="max-w-sm text-sm text-text-muted">
              {activeCategory === 'all'
                ? 'Keep spending time together to start unlocking achievements.'
                : 'No achievements in this category yet — try another filter.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((achievement) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              onToggleShowcase={handleToggleShowcase}
            />
          ))}
        </div>
      )}
    </div>
  );
}
