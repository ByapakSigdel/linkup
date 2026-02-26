'use client';

import { Phone, Video, MoreVertical, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui';
import { timeAgo } from '@linkup/utils';

interface ChatHeaderProps {
  partnerName: string;
  partnerAvatar?: string | null;
  isOnline: boolean;
  lastSeenAt?: string;
  className?: string;
  onBack?: () => void;
}

export function ChatHeader({
  partnerName,
  partnerAvatar,
  isOnline,
  lastSeenAt,
  className,
  onBack,
}: ChatHeaderProps) {
  const statusText = isOnline
    ? 'Online'
    : lastSeenAt
      ? `Last seen ${timeAgo(lastSeenAt)}`
      : 'Offline';

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border bg-surface px-4 py-3',
        className,
      )}
    >
      {/* Back button (mobile) */}
      {onBack && (
        <button
          onClick={onBack}
          className="lg:hidden p-1 -ml-1 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Partner info */}
      <Avatar
        src={partnerAvatar}
        name={partnerName}
        size="md"
        status={isOnline ? 'online' : 'offline'}
      />
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-text truncate">
          {partnerName}
        </h2>
        <p
          className={cn(
            'text-xs',
            isOnline ? 'text-success' : 'text-text-muted',
          )}
        >
          {statusText}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        <button
          className="p-2 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          aria-label="Voice call"
        >
          <Phone className="h-5 w-5" />
        </button>
        <button
          className="p-2 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          aria-label="Video call"
        >
          <Video className="h-5 w-5" />
        </button>
        <button
          className="p-2 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
          aria-label="More options"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
