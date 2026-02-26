'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Heart,
  Flame,
  MessageCircle,
  Image as ImageIcon,
  Trophy,
  Calendar,
  Pencil,
  Palette,
  Camera,
  Clock,
  ChevronRight,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useStreaksStore } from '@/stores/streaks-store';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Avatar,
  Button,
  Spinner,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';

interface DashboardData {
  coupleStats: {
    messageCount: number;
    mediaCount: number;
    currentStreak: number;
    longestStreak: number;
    totalPoints: number;
    achievementCount: number;
  } | null;
  partner: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    isOnline: boolean | null;
  } | null;
  upcomingDates: Array<{
    id: string;
    title: string;
    date: string;
    type: string;
  }>;
  recentAchievements: Array<{
    id: string;
    name: string;
    points: number;
    unlockedAt: string | null;
  }>;
}

const quickActions = [
  { href: '/chat', label: 'Message', icon: MessageCircle, color: 'bg-primary/10 text-primary' },
  { href: '/scribble', label: 'Draw', icon: Pencil, color: 'bg-secondary/10 text-secondary' },
  { href: '/gallery', label: 'Photos', icon: Camera, color: 'bg-accent/10 text-accent' },
  { href: '/paint', label: 'Paint', icon: Palette, color: 'bg-info/10 text-info' },
] as const;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const { streak, fetchStreak } = useStreaksStore();

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    coupleStats: null,
    partner: null,
    upcomingDates: [],
    recentAchievements: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch profile data which includes partner + couple stats
      const { data } = await api.get('/users/me/profile');
      const profileData = data.data;

      // Fetch upcoming dates
      let upcomingDates: DashboardData['upcomingDates'] = [];
      try {
        const datesRes = await api.get('/dates', {
          params: { limit: 5 },
        });
        upcomingDates = datesRes.data.data?.dates ?? [];
      } catch {
        // dates endpoint may not return data if no couple
      }

      setDashboardData({
        coupleStats: profileData.coupleStats ?? null,
        partner: profileData.partner ?? null,
        upcomingDates,
        recentAchievements: profileData.coupleStats?.showcasedAchievements ?? [],
      });
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStreak();
  }, [fetchDashboard, fetchStreak]);

  // Days together
  const daysTogether = couple?.createdAt
    ? Math.floor(
        (Date.now() - new Date(couple.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      )
    : 0;

  // Hours remaining for streak
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const msRemaining = midnight.getTime() - now.getTime();
  const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  const today = new Date().toISOString().split('T')[0];
  const hasContributedToday = streak?.lastPhotoDate === today;

  // Days until upcoming dates
  function daysUntilDate(dateStr: string): number {
    const target = new Date(dateStr);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const { coupleStats, partner } = dashboardData;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Couple Header */}
      <Card cardStyle="elevated" padding="lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-4">
            <Avatar
              src={user?.avatarUrl}
              name={user?.displayName}
              size="xl"
              status={user?.isOnline ? 'online' : 'offline'}
            />
            <Heart className="h-6 w-6 text-primary" />
            {partner ? (
              <Avatar
                src={partner.avatarUrl}
                name={partner.displayName}
                size="xl"
                status={partner.isOnline ? 'online' : 'offline'}
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border">
                <span className="text-2xl text-text-muted">?</span>
              </div>
            )}
          </div>

          <h2 className="mt-4 text-xl font-bold text-text">
            {partner
              ? couple?.coupleName || `${user?.displayName} & ${partner.displayName}`
              : `Hey, ${user?.displayName}`}
          </h2>
          <p className="text-text-muted">
            {partner ? `Together for ${daysTogether} days` : 'Invite your partner to get started'}
          </p>

          {/* Quick Stats */}
          {coupleStats && (
            <div className="mt-4 grid w-full max-w-md grid-cols-4 gap-3">
              <div className="flex flex-col items-center rounded-lg bg-surface-hover p-2">
                <Flame className="h-4 w-4 text-accent" />
                <span className="mt-1 text-lg font-bold text-text">
                  {coupleStats.currentStreak}
                </span>
                <span className="text-[10px] text-text-muted">Streak</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-surface-hover p-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="mt-1 text-lg font-bold text-text">
                  {coupleStats.messageCount > 999
                    ? `${Math.floor(coupleStats.messageCount / 1000)}k`
                    : coupleStats.messageCount}
                </span>
                <span className="text-[10px] text-text-muted">Messages</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-surface-hover p-2">
                <ImageIcon className="h-4 w-4 text-secondary" />
                <span className="mt-1 text-lg font-bold text-text">
                  {coupleStats.mediaCount}
                </span>
                <span className="text-[10px] text-text-muted">Photos</span>
              </div>
              <div className="flex flex-col items-center rounded-lg bg-surface-hover p-2">
                <Trophy className="h-4 w-4 text-accent" />
                <span className="mt-1 text-lg font-bold text-text">
                  {coupleStats.achievementCount}
                </span>
                <span className="text-[10px] text-text-muted">Awards</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Photo Streak Widget */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-accent" />
              Photo Streak
            </CardTitle>
            <Link href="/streaks" className="text-sm font-medium text-primary hover:underline">
              View
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-16 w-16 items-center justify-center rounded-full',
                  streak && streak.currentStreak > 0
                    ? 'bg-gradient-to-br from-accent to-primary'
                    : 'bg-surface-hover',
                )}
              >
                <Flame
                  className={cn(
                    'h-8 w-8',
                    streak && streak.currentStreak > 0
                      ? 'streak-flame text-text-on-primary'
                      : 'text-text-muted',
                  )}
                />
              </div>
              <div>
                <p className="text-2xl font-bold text-text">
                  {streak?.currentStreak ?? 0} {(streak?.currentStreak ?? 0) === 1 ? 'Day' : 'Days'}
                </p>
                {hasContributedToday ? (
                  <p className="flex items-center gap-1 text-sm text-success">
                    <Camera className="h-3.5 w-3.5" />
                    Photo shared today
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-sm text-text-muted">
                    <Clock className="h-3.5 w-3.5" />
                    {hoursRemaining}h {minutesRemaining}m remaining
                  </p>
                )}
              </div>
            </div>
            {!hasContributedToday && (
              <Link href="/streaks">
                <Button variant="primary" size="sm">
                  <Camera className="mr-1.5 h-4 w-4" />
                  Share
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Dates */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Dates
            </CardTitle>
            <Link href="/profile" className="text-sm font-medium text-primary hover:underline">
              Manage
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {dashboardData.upcomingDates.length === 0 ? (
            <p className="py-3 text-center text-sm text-text-muted">
              No upcoming dates. Add important dates in your profile!
            </p>
          ) : (
            <div className="space-y-3">
              {dashboardData.upcomingDates.slice(0, 3).map((d) => {
                const daysLeft = daysUntilDate(d.date);
                return (
                  <div key={d.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text">{d.title}</p>
                        <p className="text-xs text-text-muted">
                          {new Date(d.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        daysLeft <= 3
                          ? 'bg-error/10 text-error'
                          : daysLeft <= 7
                            ? 'bg-warning/10 text-warning'
                            : 'bg-surface-hover text-text-muted',
                      )}
                    >
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Achievements */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent" />
              Recent Achievements
            </CardTitle>
            <Link href="/hall-of-fame" className="text-sm font-medium text-primary hover:underline">
              View
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {dashboardData.recentAchievements.length === 0 ? (
            <p className="py-3 text-center text-sm text-text-muted">
              No achievements yet. Keep using LinkUp to unlock them!
            </p>
          ) : (
            <div className="space-y-3">
              {dashboardData.recentAchievements.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                      <Star className="h-4 w-4 text-accent" />
                    </div>
                    <p className="text-sm font-medium text-text">
                      {a.name || 'Achievement'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-accent">
                    {a.points} pts
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card cardStyle="bordered" padding="md">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href}>
                  <div className="flex flex-col items-center gap-2 rounded-xl p-3 transition-colors hover:bg-surface-hover">
                    <div
                      className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-full',
                        action.color,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-text">
                      {action.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
