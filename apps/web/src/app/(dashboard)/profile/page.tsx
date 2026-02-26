'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  MessageCircle,
  Image as ImageIcon,
  Flame,
  Trophy,
  Star,
  Calendar,
  Edit3,
  Heart,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Button,
  Avatar,
  Spinner,
  Badge,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';

interface ProfileData {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    coupleId: string | null;
    themeId: string | null;
    locale: string | null;
    timezone: string | null;
    isOnline: boolean | null;
    lastSeenAt: string | null;
    isVerified: boolean | null;
    createdAt: string | null;
  };
  partner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    isOnline: boolean | null;
    lastSeenAt: string | null;
  } | null;
  coupleStats: {
    couple: {
      id: string;
      coupleName: string | null;
      anniversaryDate: string | null;
      createdAt: string | null;
    };
    messageCount: number;
    mediaCount: number;
    currentStreak: number;
    longestStreak: number;
    totalPoints: number;
    achievementCount: number;
    showcasedAchievements: Array<{
      id: string;
      achievementId: string;
      unlockedAt: string | null;
    }>;
  } | null;
}

export default function ProfilePage() {
  const authUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
  });

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/users/me/profile');
      setProfile(data.data);
      setEditForm({
        displayName: data.data.user.displayName,
        bio: data.data.user.bio || '',
      });
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    try {
      await api.patch('/users/me', editForm);
      setIsEditing(false);
      fetchProfile();
    } catch {
      // Silently fail
    }
  };

  // Calculate days together
  const daysTogether = profile?.coupleStats?.couple.createdAt
    ? Math.floor(
        (Date.now() - new Date(profile.coupleStats.couple.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-text-muted">Failed to load profile</p>
      </div>
    );
  }

  const { user, partner, coupleStats } = profile;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text">Profile</h1>
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Couple Header */}
      {partner && coupleStats && (
        <Card cardStyle="elevated" padding="lg">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-4">
              <Avatar
                src={user.avatarUrl}
                name={user.displayName}
                size="xl"
                status={user.isOnline ? 'online' : 'offline'}
              />
              <Heart className="h-6 w-6 text-primary" />
              <Avatar
                src={partner.avatarUrl}
                name={partner.displayName}
                size="xl"
                status={partner.isOnline ? 'online' : 'offline'}
              />
            </div>
            <h2 className="mt-4 text-xl font-bold text-text">
              {coupleStats.couple.coupleName ||
                `${user.displayName} & ${partner.displayName}`}
            </h2>
            <p className="text-text-muted">
              Together for {daysTogether} days
            </p>
            {coupleStats.couple.anniversaryDate && (
              <p className="text-xs text-text-muted">
                Since{' '}
                {new Date(coupleStats.couple.anniversaryDate).toLocaleDateString(
                  undefined,
                  { month: 'long', day: 'numeric', year: 'numeric' },
                )}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Partner Profiles */}
      <Card cardStyle="bordered" padding="md">
        <CardContent>
          <div className="space-y-4">
            {/* Your profile */}
            <div className="flex items-center gap-4">
              <Avatar
                src={user.avatarUrl}
                name={user.displayName}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editForm.displayName}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          displayName: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editForm.bio}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, bio: e.target.value }))
                      }
                      placeholder="Add a bio..."
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted focus:border-primary focus:outline-none"
                    />
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-text">
                      {user.displayName}
                    </p>
                    <p className="text-sm text-text-muted">@{user.username}</p>
                    {user.bio && (
                      <p className="text-sm italic text-text-muted">
                        &quot;{user.bio}&quot;
                      </p>
                    )}
                  </>
                )}
              </div>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button onClick={handleSave} variant="primary" size="sm">
                    Save
                  </Button>
                  <Button
                    onClick={() => setIsEditing(false)}
                    variant="ghost"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="ghost"
                  size="sm"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Partner */}
            {partner && (
              <div className="flex items-center gap-4">
                <Avatar
                  src={partner.avatarUrl}
                  name={partner.displayName}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-text">
                    {partner.displayName}
                  </p>
                  <p className="text-sm text-text-muted">
                    @{partner.username}
                  </p>
                  {partner.bio && (
                    <p className="text-sm italic text-text-muted">
                      &quot;{partner.bio}&quot;
                    </p>
                  )}
                </div>
                <Badge
                  variant={partner.isOnline ? 'success' : 'default'}
                >
                  {partner.isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Relationship Stats */}
      {coupleStats && (
        <Card cardStyle="bordered" padding="md">
          <CardHeader>
            <CardTitle>Relationship Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text">
                    {coupleStats.messageCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted">Messages Sent</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                  <ImageIcon className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text">
                    {coupleStats.mediaCount.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted">Photos Shared</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Flame className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text">
                    {coupleStats.currentStreak} days
                  </p>
                  <p className="text-xs text-text-muted">Current Streak</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                  <Trophy className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text">
                    {coupleStats.achievementCount}
                  </p>
                  <p className="text-xs text-text-muted">Achievements</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                  <Star className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text">
                    {coupleStats.totalPoints.toLocaleString()}
                  </p>
                  <p className="text-xs text-text-muted">Total Points</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                  <Calendar className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold text-text">{daysTogether}</p>
                  <p className="text-xs text-text-muted">Days Together</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Showcased Achievements */}
      {coupleStats && coupleStats.showcasedAchievements.length > 0 && (
        <Card cardStyle="bordered" padding="md">
          <CardHeader>
            <CardTitle>Showcased Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {coupleStats.showcasedAchievements.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg bg-surface-hover p-3"
                >
                  <Trophy className="h-6 w-6 text-accent" />
                  <div>
                    <p className="text-sm font-medium text-text">
                      Achievement
                    </p>
                    {a.unlockedAt && (
                      <p className="text-xs text-text-muted">
                        {new Date(a.unlockedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/streaks">
          <Card
            cardStyle="bordered"
            padding="md"
            className="cursor-pointer transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <Flame className="h-6 w-6 text-accent" />
              <div>
                <p className="font-semibold text-text">Photo Streaks</p>
                <p className="text-xs text-text-muted">View streak details</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link href="/hall-of-fame">
          <Card
            cardStyle="bordered"
            padding="md"
            className="cursor-pointer transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-accent" />
              <div>
                <p className="font-semibold text-text">Hall of Fame</p>
                <p className="text-xs text-text-muted">Saved highlights</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
