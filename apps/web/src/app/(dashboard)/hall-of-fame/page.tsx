'use client';

import { useState } from 'react';
import { Trophy, Star } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';
import { LinkupMark } from '@/components/brand/logo';
import { AchievementsTab } from '@/components/achievements/achievements-tab';
import { HighlightsTab } from '@/components/achievements/highlights-tab';

type Tab = 'achievements' | 'highlights';

const TABS: { value: Tab; label: string; icon: typeof Trophy }[] = [
  { value: 'achievements', label: 'Achievements', icon: Trophy },
  { value: 'highlights', label: 'Highlights', icon: Star },
];

export default function HallOfFamePage() {
  const couple = useAuthStore((s) => s.couple);
  const [activeTab, setActiveTab] = useState<Tab>('achievements');

  // Not paired state
  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LinkupMark size={56} className="mb-4 opacity-90" />
        <h2 className="text-lg font-semibold text-text">
          Your Hall of Fame awaits
        </h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to start earning achievements and saving
          your favorite moments together.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text">
          Hall of Fame
        </h1>
        <p className="text-text-muted">
          Celebrate your milestones and the memories worth keeping
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'achievements' ? <AchievementsTab /> : <HighlightsTab />}
    </div>
  );
}
