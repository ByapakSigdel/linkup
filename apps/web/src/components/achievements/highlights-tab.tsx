'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Star,
  Heart,
  MessageCircle,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { Card, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';

interface HighlightedMessage {
  id: string;
  content: string;
  senderId: string;
  highlightColor: string | null;
  highlightNote: string | null;
  highlightCategory: string | null;
  sentAt: string;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All', icon: Star },
  { value: 'love', label: 'Love', icon: Heart },
  { value: 'funny', label: 'Funny', icon: Sparkles },
  { value: 'milestone', label: 'Milestone', icon: Calendar },
  { value: 'important', label: 'Important', icon: MessageCircle },
] as const;

const HIGHLIGHT_COLORS: Record<string, string> = {
  love: 'border-l-highlight-love bg-highlight-love/10',
  funny: 'border-l-highlight-funny bg-highlight-funny/10',
  milestone: 'border-l-highlight-milestone bg-highlight-milestone/10',
  important: 'border-l-highlight-important bg-highlight-important/10',
  default: 'border-l-primary bg-primary-light',
};

export function HighlightsTab() {
  const couple = useAuthStore((s) => s.couple);
  const user = useAuthStore((s) => s.user);
  const coupleId = couple?.id;

  const [highlights, setHighlights] = useState<HighlightedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchHighlights = useCallback(async () => {
    if (!coupleId) return;
    setIsLoading(true);
    try {
      const { data } = await api.get(`/messages/couple/${coupleId}`, {
        params: {
          highlighted: true,
          limit: 100,
        },
      });
      // Filter to only highlighted messages
      const highlighted = (data.data?.messages ?? []).filter(
        (m: HighlightedMessage & { isHighlighted?: boolean }) => m.isHighlighted,
      );
      setHighlights(highlighted);
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [coupleId]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const filtered =
    activeCategory === 'all'
      ? highlights
      : highlights.filter((h) => h.highlightCategory === activeCategory);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-text-on-primary'
                  : 'bg-surface-hover text-text-muted hover:text-text',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {CATEGORIES.filter((c) => c.value !== 'all').map((cat) => {
          const count = highlights.filter(
            (h) => h.highlightCategory === cat.value,
          ).length;
          const Icon = cat.icon;
          return (
            <Card key={cat.value} cardStyle="bordered" padding="sm">
              <div className="flex flex-col items-center gap-1 py-2 text-center">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold text-text">{count}</span>
                <span className="text-xs text-text-muted">{cat.label}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Highlights List */}
      {filtered.length === 0 ? (
        <Card cardStyle="bordered" padding="lg">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Star className="h-12 w-12 text-text-muted opacity-40" />
            <h3 className="text-lg font-semibold text-text">
              No highlights yet
            </h3>
            <p className="max-w-sm text-sm text-text-muted">
              Highlight your favorite messages in chat to save them here. Tap
              the star icon on any message!
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((msg) => {
            const colorClass =
              HIGHLIGHT_COLORS[msg.highlightCategory ?? 'default'] ??
              HIGHLIGHT_COLORS['default']!;
            const isMine = msg.senderId === user?.id;

            return (
              <Card
                key={msg.id}
                cardStyle="flat"
                padding="md"
                className={cn('border-l-4', colorClass)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-text-muted">
                      {isMine ? 'You' : couple?.coupleName ?? 'Partner'}
                    </span>
                    <span className="text-xs text-text-muted">
                      {new Date(msg.sentAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-text">{msg.content}</p>
                  {msg.highlightNote && (
                    <p className="text-xs italic text-text-muted">
                      &quot;{msg.highlightNote}&quot;
                    </p>
                  )}
                  {msg.highlightCategory && (
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        msg.highlightCategory === 'love' &&
                          'bg-highlight-love/20 text-highlight-love',
                        msg.highlightCategory === 'funny' &&
                          'bg-highlight-funny/20 text-highlight-funny',
                        msg.highlightCategory === 'milestone' &&
                          'bg-highlight-milestone/20 text-highlight-milestone',
                        msg.highlightCategory === 'important' &&
                          'bg-highlight-important/20 text-highlight-important',
                      )}
                    >
                      {msg.highlightCategory}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
