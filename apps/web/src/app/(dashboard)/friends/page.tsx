'use client';

import { UserPlus, Search, Heart } from 'lucide-react';
import { Card, Button, Input } from '@/components/ui';

export default function FriendsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Friends</h1>
        <p className="text-text-muted">
          Find and connect with friends on LinkUp
        </p>
      </div>

      {/* Search bar (disabled preview) */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="Search for friends..."
          className="pl-10"
          disabled
        />
      </div>

      {/* Empty state */}
      <Card cardStyle="bordered" padding="lg">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <UserPlus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text">
            Friends — Coming Soon
          </h3>
          <p className="max-w-md text-sm text-text-muted">
            Add friends, see what other couples are up to, and grow your
            community. This feature is currently in development.
          </p>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Heart className="h-3.5 w-3.5 text-primary" />
            <span>Stay tuned for updates</span>
          </div>
        </div>
      </Card>

      {/* Feature preview cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card cardStyle="bordered" padding="md">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
              <UserPlus className="h-5 w-5 text-text-muted" />
            </div>
            <h4 className="font-semibold text-text">Friend Requests</h4>
            <p className="text-sm text-text-muted">
              Send and receive friend requests from other LinkUp users.
            </p>
          </div>
        </Card>
        <Card cardStyle="bordered" padding="md">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
              <Search className="h-5 w-5 text-text-muted" />
            </div>
            <h4 className="font-semibold text-text">Discover Couples</h4>
            <p className="text-sm text-text-muted">
              Find couples with shared interests and mutual connections.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
