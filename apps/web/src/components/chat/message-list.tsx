'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatStore } from '@/stores/chat-store';
import { useAuthStore } from '@/stores/auth-store';
import { MessageBubble } from './message-bubble';
import type { Message } from '@linkup/types';

interface MessageListProps {
  onReply?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onHighlight?: (message: Message) => void;
  onReact?: (messageId: string, emoji: string) => void;
  className?: string;
}

export function MessageList({
  onReply,
  onEdit,
  onDelete,
  onHighlight,
  onReact,
  className,
}: MessageListProps) {
  const messages = useChatStore((s) => s.messages);
  const isLoadingMessages = useChatStore((s) => s.isLoadingMessages);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);
  const fetchMessages = useChatStore((s) => s.fetchMessages);
  const couple = useAuthStore((s) => s.couple);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      // Only auto-scroll if user is near the bottom
      const container = scrollContainerRef.current;
      if (container) {
        const { scrollHeight, scrollTop, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

        if (isNearBottom || prevMessageCountRef.current === 0) {
          bottomRef.current?.scrollIntoView({ behavior: prevMessageCountRef.current === 0 ? 'instant' : 'smooth' });
        }
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || isLoadingMessages || !hasMoreMessages || !couple) return;

    if (container.scrollTop < 100) {
      const prevScrollHeight = container.scrollHeight;
      fetchMessages(couple.id, messages.length).then(() => {
        // Maintain scroll position after prepending older messages
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      });
    }
  }, [isLoadingMessages, hasMoreMessages, couple, messages.length, fetchMessages]);

  // Date separator logic
  const getDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    }
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
    });
  };

  const shouldShowDateSeparator = (msg: Message, prevMsg: Message | undefined): boolean => {
    if (!prevMsg) return true;
    const curr = new Date(msg.sentAt || msg.createdAt).toDateString();
    const prev = new Date(prevMsg.sentAt || prevMsg.createdAt).toDateString();
    return curr !== prev;
  };

  const isGrouped = (msg: Message, prevMsg: Message | undefined): boolean => {
    if (!prevMsg) return false;
    if (msg.senderId !== prevMsg.senderId) return false;
    const timeDiff =
      new Date(msg.sentAt || msg.createdAt).getTime() -
      new Date(prevMsg.sentAt || prevMsg.createdAt).getTime();
    return timeDiff < 60000; // Within 1 minute
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className={cn(
        'flex-1 overflow-y-auto px-4 py-4',
        className,
      )}
    >
      {/* Loading indicator for older messages */}
      {isLoadingMessages && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoadingMessages && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="h-16 w-16 rounded-full bg-primary-light flex items-center justify-center mb-4">
            <span className="text-2xl">\uD83D\uDC8C</span>
          </div>
          <h3 className="text-lg font-semibold text-text mb-1">
            Start your conversation
          </h3>
          <p className="text-sm text-text-muted max-w-xs">
            Send your first message and start creating memories together.
          </p>
        </div>
      )}

      {/* Messages */}
      {messages.map((message, index) => {
        const prevMessage = index > 0 ? messages[index - 1] : undefined;
        const showDate = shouldShowDateSeparator(message, prevMessage);
        const grouped = isGrouped(message, prevMessage);

        return (
          <div key={message.id}>
            {/* Date separator */}
            {showDate && (
              <div className="flex items-center justify-center my-4">
                <div className="h-px flex-1 bg-border" />
                <span className="px-3 text-xs font-medium text-text-muted bg-background">
                  {getDateLabel(message.sentAt || message.createdAt)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}

            <MessageBubble
              message={message}
              showTimestamp={!grouped}
              isGroupedWithPrevious={grouped}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onHighlight={onHighlight}
              onReact={onReact}
            />
          </div>
        );
      })}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
