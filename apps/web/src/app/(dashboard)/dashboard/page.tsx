'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Flame,
  MessageCircle,
  Video,
  Pencil,
  Camera,
  Clapperboard,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useStreaksStore } from '@/stores/streaks-store';
import { useChatStore } from '@/stores/chat-store';
import { useSocket } from '@/hooks/use-socket';
import { useCall } from '@/hooks/use-call';
import { Card, Avatar, Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { LinkupMark } from '@/components/brand/logo';
import { PairingCard } from '@/components/couple/pairing-card';
import api from '@/lib/api';

interface Partner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean | null;
}

interface UpcomingDate {
  id: string;
  title: string;
  date: string;
}

const quickActions = [
  { href: '/chat', label: 'Message', icon: MessageCircle },
  { href: '/scribble', label: 'Draw', icon: Pencil },
  { href: '/gallery', label: 'Photos', icon: Camera },
  { href: '/watch', label: 'Watch', icon: Clapperboard },
] as const;

function lastSeenText(iso?: string): string {
  if (!iso) return 'offline';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'last seen just now';
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  return `last seen ${Math.floor(h / 24)}d ago`;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  const { streak, fetchStreak } = useStreaksStore();

  // Live partner presence (kept fresh app-wide by the realtime provider).
  const isPartnerOnline = useChatStore((s) => s.isPartnerOnline);
  const partnerLastSeenAt = useChatStore((s) => s.partnerLastSeenAt);
  const { requestPresence } = useSocket();
  const { startCall } = useCall();

  const [partner, setPartner] = useState<Partner | null>(null);
  const [nextDate, setNextDate] = useState<UpcomingDate | null>(null);
  const [seededOnline, setSeededOnline] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/users/me/profile');
      const p = data.data?.partner ?? null;
      setPartner(p);
      setSeededOnline(p?.isOnline ?? null);
      try {
        const datesRes = await api.get('/dates', { params: { limit: 1 } });
        setNextDate(datesRes.data.data?.dates?.[0] ?? null);
      } catch {
        /* no dates */
      }
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    fetchStreak();
  }, [fetchDashboard, fetchStreak]);

  // Ask for the partner's current status now, then keep it fresh.
  useEffect(() => {
    requestPresence();
    const t = setInterval(requestPresence, 30000);
    return () => clearInterval(t);
  }, [requestPresence]);

  const daysTogether = couple?.createdAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(couple.createdAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  // Streak time-left
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const msLeft = midnight.getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);
  const today = new Date().toISOString().split('T')[0];
  const sharedToday = streak?.lastPhotoDate === today;

  const daysUntil = (iso: string) => {
    const t = new Date(iso);
    t.setHours(0, 0, 0, 0);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return Math.ceil((t.getTime() - d.getTime()) / 86_400_000);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not linked up — pairing front and centre.
  if (!couple?.isPaired) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 p-4 md:p-6">
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <LinkupMark size={56} />
          <h2 className="text-2xl font-semibold text-text">
            Welcome to linkup, {user?.displayName}
          </h2>
          <p className="max-w-md text-text-muted">
            You&apos;re one step away. Create your private couple space or join
            with your partner&apos;s code to unlock chat, streaks, watch parties
            and more.
          </p>
        </div>
        <PairingCard />
      </div>
    );
  }

  const hour = now.getHours();
  const greeting =
    hour < 5 ? 'Still up' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  // Prefer the live presence value; fall back to the freshly-fetched one.
  const online = isPartnerOnline || (partnerLastSeenAt === undefined && seededOnline === true);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 md:p-6">
      {/* ── Partner presence — the centrepiece ── */}
      <Card cardStyle="elevated" padding="lg">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
          {greeting}, {user?.displayName}
        </p>

        {partner ? (
          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <Avatar
                src={partner.avatarUrl}
                name={partner.displayName}
                size="xl"
              />
              <span
                className={cn(
                  'absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-surface',
                  online ? 'bg-success' : 'bg-text-muted',
                )}
              >
                {online && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-success/70" />
                )}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold text-text">
                {partner.displayName}
              </h1>
              <p
                className={cn(
                  'text-sm font-medium',
                  online ? 'text-success' : 'text-text-muted',
                )}
              >
                {online ? 'Online now' : lastSeenText(partnerLastSeenAt)}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Together {daysTogether} days
                {streak && streak.currentStreak > 0 && (
                  <>
                    {' · '}
                    <Flame className="h-3.5 w-3.5 text-accent" />
                    {streak.currentStreak}-day streak
                  </>
                )}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-text-muted">Invite your partner to get started.</p>
        )}

        {partner && (
          <div className="mt-5 flex gap-3">
            <Link href="/chat" className="flex-1">
              <Button variant="primary" size="md" className="w-full">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Message
              </Button>
            </Link>
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() =>
                startCall('video', {
                  id: partner.id,
                  displayName: partner.displayName,
                  avatarUrl: partner.avatarUrl ?? undefined,
                })
              }
            >
              <Video className="mr-1.5 h-4 w-4" />
              Video call
            </Button>
          </div>
        )}
      </Card>

      {/* ── Today's streak — the one daily action ── */}
      <Card cardStyle="bordered" padding="md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-full',
                streak && streak.currentStreak > 0
                  ? 'bg-gradient-to-br from-accent to-primary'
                  : 'bg-surface-hover',
              )}
            >
              <Flame
                className={cn(
                  'h-7 w-7',
                  streak && streak.currentStreak > 0
                    ? 'streak-flame text-text-on-primary'
                    : 'text-text-muted',
                )}
              />
            </div>
            <div>
              <p className="text-lg font-bold text-text">
                <span className="font-mono">{streak?.currentStreak ?? 0}</span>{' '}
                day{(streak?.currentStreak ?? 0) === 1 ? '' : 's'} streak
              </p>
              {sharedToday ? (
                <p className="flex items-center gap-1 text-sm text-success">
                  <Camera className="h-3.5 w-3.5" /> Photo shared today
                </p>
              ) : (
                <p className="flex items-center gap-1 text-sm text-text-muted">
                  <Clock className="h-3.5 w-3.5" /> {hoursLeft}h {minutesLeft}m left today
                </p>
              )}
            </div>
          </div>
          {!sharedToday && (
            <Link href="/streaks">
              <Button variant="primary" size="sm">
                <Camera className="mr-1.5 h-4 w-4" /> Share
              </Button>
            </Link>
          )}
        </div>
      </Card>

      {/* ── Next important date — only when there is one ── */}
      {nextDate && (
        <Link href="/profile">
          <Card cardStyle="bordered" padding="md" className="transition-colors hover:bg-surface-hover">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{nextDate.title}</p>
                  <p className="text-xs text-text-muted">
                    {new Date(nextDate.date).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-surface-hover px-3 py-1 text-xs font-medium text-text">
                {(() => {
                  const d = daysUntil(nextDate.date);
                  return d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d} days`;
                })()}
              </span>
            </div>
          </Card>
        </Link>
      )}

      {/* ── Quick actions ── */}
      <div className="grid grid-cols-4 gap-3">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium text-text">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
