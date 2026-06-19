'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Emoji } from '@/components/ui';
import type { HighlightCategory } from '@linkup/types';

const highlights: {
  category: HighlightCategory;
  label: string;
  color: string;
  emoji: string;
}[] = [
  { category: 'love', label: 'Love', color: '#FF6B9D', emoji: '\u2764\uFE0F' },
  { category: 'funny', label: 'Funny', color: '#FFD93D', emoji: '\uD83D\uDE02' },
  { category: 'important', label: 'Important', color: '#6BCB77', emoji: '\u2757' },
  { category: 'celebration', label: 'Celebration', color: '#A084DC', emoji: '\uD83C\uDF89' },
  { category: 'milestone', label: 'Milestone', color: '#FF8E53', emoji: '\uD83C\uDFC6' },
];

interface HighlightPickerProps {
  onSelect: (category: HighlightCategory, color: string) => void;
  onClose: () => void;
  className?: string;
}

export function HighlightPicker({ onSelect, onClose, className }: HighlightPickerProps) {
  return (
    <div
      className={cn(
        'absolute z-20 rounded-xl bg-surface border border-border shadow-lg p-3 min-w-[200px]',
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Star className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-text">Highlight as...</span>
      </div>
      <div className="space-y-1">
        {highlights.map((h) => (
          <button
            key={h.category}
            onClick={() => {
              onSelect(h.category, h.color);
              onClose();
            }}
            className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-hover transition-colors"
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: h.color }}
            />
            <Emoji emoji={h.emoji} size={18} />
            <span>{h.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
