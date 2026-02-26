'use client';

import { forwardRef, useState, useCallback } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Reply,
  Pencil,
  Trash2,
  Star,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import type { Message, MessageStatus, HighlightCategory } from '@linkup/types';

// ─── Highlight color map ──────────────────────────────────────────────────────

const highlightColorMap: Record<HighlightCategory, string> = {
  love: 'var(--color-highlight-love)',
  funny: 'var(--color-highlight-funny)',
  important: 'var(--color-highlight-important)',
  celebration: 'var(--color-highlight-celebration)',
  milestone: 'var(--color-highlight-milestone)',
  custom: 'var(--color-primary)',
};

// ─── Status icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 text-text-on-primary/60" />;
    case 'sent':
      return <Check className="h-3 w-3 text-text-on-primary/70" />;
    case 'delivered':
      return <CheckCheck className="h-3 w-3 text-text-on-primary/70" />;
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-error" />;
    default:
      return null;
  }
}

// ─── Reactions display ────────────────────────────────────────────────────────

function ReactionsDisplay({
  reactions,
  messageId,
}: {
  reactions: Record<string, { userId: string; emoji: string; timestamp: string }[]>;
  messageId: string;
}) {
  const entries = Object.entries(reactions).filter(([, arr]) => arr.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([emoji, arr]) => (
        <span
          key={emoji}
          className="inline-flex items-center gap-0.5 rounded-full bg-surface-hover px-1.5 py-0.5 text-xs border border-border"
        >
          <span>{emoji}</span>
          {arr.length > 1 && (
            <span className="text-text-muted">{arr.length}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

export interface MessageBubbleProps {
  message: Message;
  showTimestamp?: boolean;
  isGroupedWithPrevious?: boolean;
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onHighlight?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  (
    {
      message,
      showTimestamp = true,
      isGroupedWithPrevious = false,
      onReply,
      onEdit,
      onDelete,
      onHighlight,
      onReact,
    },
    ref,
  ) => {
    const currentUserId = useAuthStore((s) => s.user?.id);
    const isSent = message.senderId === currentUserId;
    const [showActions, setShowActions] = useState(false);

    // Deleted messages
    if (message.isDeleted) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex mb-1',
            isSent ? 'justify-end' : 'justify-start',
          )}
        >
          <div className="max-w-[70%] rounded-lg px-3 py-2 text-sm italic text-text-muted bg-surface-hover border border-border/50">
            This message was deleted
          </div>
        </div>
      );
    }

    // Highlight border
    const highlightColor = message.isHighlighted && message.highlightCategory
      ? highlightColorMap[message.highlightCategory as HighlightCategory] ?? undefined
      : undefined;

    const quickReactions = ['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE0D', '\uD83D\uDD25', '\uD83D\uDC4D'];

    return (
      <div
        ref={ref}
        className={cn(
          'group flex mb-1 relative',
          isSent ? 'justify-end' : 'justify-start',
          !isGroupedWithPrevious && 'mt-2',
        )}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Action menu (hover) */}
        {showActions && (
          <div
            className={cn(
              'absolute top-0 flex items-center gap-0.5 z-10',
              isSent ? 'right-[calc(70%+8px)]' : 'left-[calc(70%+8px)]',
            )}
          >
            {/* Quick reactions */}
            <div className="flex items-center gap-0.5 rounded-full bg-surface border border-border shadow-md px-1.5 py-0.5">
              {quickReactions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReact?.(message.id, emoji)}
                  className="hover:scale-125 transition-transform text-sm p-0.5"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* More actions */}
            <div className="flex items-center gap-0.5 rounded-full bg-surface border border-border shadow-md px-1 py-0.5">
              <button
                onClick={() => onReply?.(message)}
                className="p-1 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                aria-label="Reply"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              {isSent && (
                <button
                  onClick={() => onEdit?.(message)}
                  className="p-1 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onHighlight?.(message)}
                className="p-1 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors"
                aria-label="Highlight"
              >
                <Star className="h-3.5 w-3.5" />
              </button>
              {isSent && (
                <button
                  onClick={() => onDelete?.(message.id)}
                  className="p-1 rounded-full hover:bg-surface-hover text-text-muted hover:text-error transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="max-w-[70%] flex flex-col">
          {/* Thread indicator */}
          {message.threadReplyCount && message.threadReplyCount > 0 && (
            <button className="flex items-center gap-1 text-xs text-primary hover:underline mb-0.5 self-start">
              <MessageSquare className="h-3 w-3" />
              {message.threadReplyCount} {message.threadReplyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}

          {/* Bubble */}
          <div
            className={cn(
              'px-3 py-2 text-sm leading-relaxed break-words',
              isSent
                ? 'text-message-sent-text'
                : 'bg-message-received text-message-received-text',
            )}
            style={{
              borderRadius: isSent
                ? 'var(--chat-bubble-sent-radius)'
                : 'var(--chat-bubble-received-radius)',
              boxShadow: 'var(--chat-bubble-shadow)',
              background: isSent
                ? 'var(--gradient-primary)'
                : undefined,
              ...(highlightColor
                ? {
                    border: `2px solid ${highlightColor}`,
                  }
                : {}),
            }}
          >
            {/* Highlight note */}
            {message.isHighlighted && message.highlightNote && (
              <div
                className="text-xs mb-1 opacity-80 font-medium flex items-center gap-1"
                style={{ color: highlightColor }}
              >
                <Star className="h-3 w-3" />
                {message.highlightNote}
              </div>
            )}

            {/* Content */}
            <p className="whitespace-pre-wrap">{message.content}</p>

            {/* Edited indicator */}
            {message.isEdited && (
              <span className={cn(
                'text-[10px] ml-1',
                isSent ? 'text-text-on-primary/60' : 'text-text-muted',
              )}>
                (edited)
              </span>
            )}

            {/* Timestamp + status */}
            {showTimestamp && (
              <div
                className={cn(
                  'flex items-center gap-1 mt-1',
                  isSent ? 'justify-end' : 'justify-start',
                )}
              >
                <span
                  className={cn(
                    'text-[10px]',
                    isSent ? 'text-text-on-primary/60' : 'text-text-muted',
                  )}
                >
                  {formatTime(message.sentAt || message.createdAt)}
                </span>
                {isSent && <StatusIcon status={message.status} />}
              </div>
            )}
          </div>

          {/* Reactions */}
          {message.reactions && (
            <ReactionsDisplay reactions={message.reactions} messageId={message.id} />
          )}
        </div>
      </div>
    );
  },
);

MessageBubble.displayName = 'MessageBubble';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
