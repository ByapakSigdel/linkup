'use client';

import { Users, UserPlus } from 'lucide-react';
import { Spinner, Badge } from '@/components/ui';
import { FriendCard } from './friend-card';
import type { Friend } from './types';

interface FriendsTabProps {
  friends: Friend[];
  count: number;
  maxAllowed: number;
  loading: boolean;
  onChanged: () => void;
  onDiscover: () => void;
}

export function FriendsTab({
  friends,
  count,
  maxAllowed,
  loading,
  onChanged,
  onDiscover,
}: FriendsTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const atLimit = count >= maxAllowed;

  return (
    <div className="space-y-4">
      {/* Count header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          <span className="font-mono font-semibold text-text">{count}</span>
          <span className="font-mono"> / {maxAllowed}</span> friend
          {maxAllowed !== 1 ? 's' : ''}
        </p>
        {atLimit && (
          <Badge variant="warning" size="sm">
            Limit reached
          </Badge>
        )}
      </div>

      {friends.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-text">No friends yet</h3>
            <p className="mx-auto max-w-sm text-sm text-text-muted">
              Find people you know and send them a friend request to start
              connecting.
            </p>
          </div>
          <button
            onClick={onDiscover}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-text-on-primary transition-colors hover:bg-primary-hover"
          >
            <UserPlus className="h-4 w-4" />
            Discover people
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {friends.map((friend) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
