'use client';

import {
  Search as SearchIcon,
  MessageCircle,
  Image as ImageIcon,
  Calendar,
  Smile,
  Music,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type SearchType = '' | 'messages' | 'media' | 'dates' | 'emojis' | 'playlists';

interface FilterOption {
  value: SearchType;
  label: string;
  icon: typeof SearchIcon;
}

export const SEARCH_FILTERS: FilterOption[] = [
  { value: '', label: 'All', icon: SearchIcon },
  { value: 'messages', label: 'Messages', icon: MessageCircle },
  { value: 'media', label: 'Media', icon: ImageIcon },
  { value: 'dates', label: 'Dates', icon: Calendar },
  { value: 'emojis', label: 'Emojis', icon: Smile },
  { value: 'playlists', label: 'Playlists', icon: Music },
];

interface SearchFiltersProps {
  active: SearchType;
  onChange: (type: SearchType) => void;
}

export function SearchFilters({ active, onChange }: SearchFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {SEARCH_FILTERS.map((filter) => {
        const Icon = filter.icon;
        const isActive = active === filter.value;
        return (
          <button
            key={filter.value || 'all'}
            type="button"
            onClick={() => onChange(filter.value)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-text-on-primary shadow-sm'
                : 'bg-surface-hover text-text-muted hover:text-text',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{filter.label}</span>
          </button>
        );
      })}
    </div>
  );
}
