'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, Inbox, Compass, Heart } from 'lucide-react';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { Badge } from '@/components/ui';
import {
  FriendsTab,
  RequestsTab,
  DiscoverTab,
  type Friend,
  type ReceivedInvitation,
  type SentInvitation,
} from '@/components/friends';

type TabKey = 'friends' | 'requests' | 'discover';

export default function FriendsPage() {
  const couple = useAuthStore((s) => s.couple);

  const [activeTab, setActiveTab] = useState<TabKey>('friends');

  // Friends
  const [friends, setFriends] = useState<Friend[]>([]);
  const [count, setCount] = useState(0);
  const [maxAllowed, setMaxAllowed] = useState(10);
  const [loadingFriends, setLoadingFriends] = useState(true);

  // Invites
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  const [sent, setSent] = useState<SentInvitation[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);

  const isPaired = !!couple?.isPaired;

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const { data } = await api.get('/friends');
      setFriends(data.data.friends ?? []);
      setCount(data.data.count ?? 0);
      setMaxAllowed(data.data.maxAllowed ?? 10);
    } catch {
      setFriends([]);
      setCount(0);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const { data } = await api.get('/friends/invites');
      setInvitations(data.data.invitations ?? []);
      setSent(data.data.sent ?? []);
    } catch {
      setInvitations([]);
      setSent([]);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  const refetchAll = useCallback(() => {
    fetchFriends();
    fetchInvites();
  }, [fetchFriends, fetchInvites]);

  useEffect(() => {
    if (!isPaired) return;
    refetchAll();
  }, [isPaired, refetchAll]);

  const pendingCount = invitations.length;
  const atLimit = count >= maxAllowed;

  const tabs: { key: TabKey; label: string; icon: typeof Users; badge?: number }[] =
    [
      { key: 'friends', label: 'Friends', icon: Users },
      { key: 'requests', label: 'Requests', icon: Inbox, badge: pendingCount },
      { key: 'discover', label: 'Discover', icon: Compass },
    ];

  // ---- Not paired empty state ----
  if (!isPaired) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Friends</h1>
          <p className="text-text-muted">
            Find and connect with friends on LinkUp
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-text">
              Link up with your partner first
            </h2>
            <p className="mx-auto max-w-sm text-sm text-text-muted">
              Link up with your partner first to add friends. Once you are
              paired, you can connect with up to 10 friends.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Your people
        </p>
        <h1 className="font-display text-2xl font-bold text-text">Friends</h1>
        <p className="text-text-muted">
          Connect with friends and choose what you share
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.badge ? (
                <Badge
                  variant={active ? 'default' : 'error'}
                  size="sm"
                  className="ml-0.5"
                >
                  {tab.badge}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'friends' && (
        <FriendsTab
          friends={friends}
          count={count}
          maxAllowed={maxAllowed}
          loading={loadingFriends}
          onChanged={refetchAll}
          onDiscover={() => setActiveTab('discover')}
        />
      )}

      {activeTab === 'requests' && (
        <RequestsTab
          invitations={invitations}
          sent={sent}
          loading={loadingInvites}
          onChanged={refetchAll}
        />
      )}

      {activeTab === 'discover' && (
        <DiscoverTab
          atLimit={atLimit}
          maxAllowed={maxAllowed}
          onInvited={refetchAll}
        />
      )}
    </div>
  );
}
