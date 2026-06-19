'use client';

import { forwardRef, useState, useCallback, useEffect } from 'react';
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
  SmilePlus,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Emoji } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { ALL_REACTIONS } from '@/lib/reaction-packs';
import {
  STICKER_REACTIONS,
  ReactionGlyph,
  isSticker,
} from '@/components/reactions/stickers';
import {
  useCustomEmojiStore,
  type CustomEmojiEntry,
} from '@/stores/custom-emoji-store';
import { MediaMessage } from './media-message';
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

// ─── Custom-emoji shortcode rendering ──────────────────────────────────────────

/** Render message text, swapping `:shortcode:` tokens for custom-emoji images. */
function renderMessageText(
  content: string,
  byName: Record<string, CustomEmojiEntry>,
): React.ReactNode {
  if (!content.includes(':')) return content;
  const parts = content.split(/(:[a-zA-Z0-9_+-]+:)/g);
  return parts.map((part, i) => {
    const match = /^:([a-zA-Z0-9_+-]+):$/.exec(part);
    const emoji = match ? byName[match[1]!] : undefined;
    if (emoji) {
      return (
        <img
          key={i}
          src={emoji.imageUrl}
          alt={part}
          title={part}
          className="inline-block h-5 w-5 align-[-0.3em] object-contain"
          loading="lazy"
        />
      );
    }
    return part;
  });
}

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
          className={cn(
            'lk-reaction-pop inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs border border-border',
            isSticker(emoji) ? 'bg-white/95' : 'bg-surface-hover',
          )}
        >
          <ReactionGlyph value={emoji} size={16} />
          {arr.length > 1 && (
            <span
              className={cn(
                'font-mono',
                isSticker(emoji) ? 'text-[#17171c]' : 'text-text-muted',
              )}
            >
              {arr.length}
            </span>
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
    const emojiByName = useCustomEmojiStore((s) => s.byName);
    const loadCustomEmojis = useCustomEmojiStore((s) => s.load);
    const [showAllReactions, setShowAllReactions] = useState(false);
    useEffect(() => {
      void loadCustomEmojis();
    }, [loadCustomEmojis]);

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
            {/* Quick reactions — sticker pack + full picker (stickers + emoji) */}
            <div className="relative flex items-center gap-0.5 rounded-full bg-surface border border-border shadow-md px-1.5 py-0.5">
              {STICKER_REACTIONS.slice(0, 6).map((val) => (
                <button
                  key={val}
                  onClick={() => onReact?.(message.id, val)}
                  className="flex items-center justify-center rounded-lg bg-white/95 p-0.5 transition-transform hover:scale-125 active:scale-90"
                  aria-label="React with sticker"
                >
                  <ReactionGlyph value={val} size={22} />
                </button>
              ))}
              <button
                onClick={() => setShowAllReactions((v) => !v)}
                className="flex items-center justify-center p-0.5 text-text-muted transition-colors hover:text-text"
                aria-label="More reactions"
              >
                <SmilePlus className="h-4 w-4" />
              </button>

              {showAllReactions && (
                <div className="absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-2xl border border-border bg-surface p-2.5 shadow-2xl">
                  <p className="mb-1 px-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Stickers
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {STICKER_REACTIONS.map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          onReact?.(message.id, val);
                          setShowAllReactions(false);
                        }}
                        className="flex items-center justify-center rounded-lg bg-white/95 p-1 transition-transform hover:scale-110"
                        aria-label="React with sticker"
                      >
                        <ReactionGlyph value={val} size={26} />
                      </button>
                    ))}
                  </div>
                  <p className="mb-1 mt-2.5 px-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Emoji
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {ALL_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          onReact?.(message.id, emoji);
                          setShowAllReactions(false);
                        }}
                        className="flex items-center justify-center rounded-md p-1 transition-transform hover:scale-125 hover:bg-surface-hover"
                        aria-label={`React with ${emoji}`}
                      >
                        <Emoji emoji={emoji} size={18} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                ? 'bg-message-sent text-message-sent-text'
                : 'bg-message-received text-message-received-text',
            )}
            style={{
              borderRadius: isSent
                ? 'var(--chat-bubble-sent-radius)'
                : 'var(--chat-bubble-received-radius)',
              boxShadow: 'var(--chat-bubble-shadow)',
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

            {/* Media (photos / videos / voice / scribble) */}
            {message.mediaUrls && message.mediaUrls.length > 0 && (
              <div className={cn(message.content && message.messageType !== 'voice' && 'mb-1.5')}>
                <MediaMessage
                  mediaUrls={message.mediaUrls}
                  isSent={isSent}
                  messageType={message.messageType}
                />
              </div>
            )}

            {/* Content — hidden for voice messages (the player stands alone) */}
            {message.content && message.messageType !== 'voice' && (
              <p className="whitespace-pre-wrap">
                {renderMessageText(message.content, emojiByName)}
              </p>
            )}

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
