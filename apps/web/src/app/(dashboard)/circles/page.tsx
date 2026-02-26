'use client';

import { Users, Heart, Plus } from 'lucide-react';
import { Card, Button } from '@/components/ui';

export default function CirclesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text">Circles</h1>
        <p className="text-text-muted">
          Connect with other couples and share moments together
        </p>
      </div>

      {/* Empty state */}
      <Card cardStyle="bordered" padding="lg">
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text">
            Couple Circles — Coming Soon
          </h3>
          <p className="max-w-md text-sm text-text-muted">
            Create private groups with other couples to share photos, plan
            double dates, and stay connected. This feature is currently in
            development.
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
              <Users className="h-5 w-5 text-text-muted" />
            </div>
            <h4 className="font-semibold text-text">Group Sharing</h4>
            <p className="text-sm text-text-muted">
              Share photos and memories within your circle of trusted couples.
            </p>
          </div>
        </Card>
        <Card cardStyle="bordered" padding="md">
          <div className="space-y-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
              <Plus className="h-5 w-5 text-text-muted" />
            </div>
            <h4 className="font-semibold text-text">Double Dates</h4>
            <p className="text-sm text-text-muted">
              Plan and coordinate activities with other couples in your circle.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
