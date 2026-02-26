'use client';

import {
  forwardRef,
  useRef,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { Send, X, Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useChatStore } from '@/stores/chat-store';
import type { Message } from '@linkup/types';

const MAX_CHARS = 10000;

export interface MessageInputProps {
  onSend: (content: string, options?: { threadId?: string; isThreadStarter?: boolean }) => void;
  onEditSend?: (messageId: string, content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  partnerName?: string;
  disabled?: boolean;
}

export const MessageInput = forwardRef<HTMLTextAreaElement, MessageInputProps>(
  (
    { onSend, onEditSend, onTypingStart, onTypingStop, partnerName, disabled },
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isTyping, setIsTyping] = useState(false);

    const editingMessage = useChatStore((s) => s.editingMessage);
    const replyingTo = useChatStore((s) => s.replyingTo);
    const setEditingMessage = useChatStore((s) => s.setEditingMessage);
    const setReplyingTo = useChatStore((s) => s.setReplyingTo);

    const [value, setValue] = useState('');

    // When editing, populate textarea with existing content
    useEffect(() => {
      if (editingMessage) {
        setValue(editingMessage.content);
        textareaRef.current?.focus();
      }
    }, [editingMessage]);

    // Auto-resize textarea
    const adjustHeight = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = 'auto';
      const maxH = parseInt(
        getComputedStyle(textarea).getPropertyValue('--chat-input-max-height') || '200',
        10,
      );
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxH)}px`;
    }, []);

    useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    // Typing indicator management
    const handleTypingStart = useCallback(() => {
      if (!isTyping) {
        setIsTyping(true);
        onTypingStart?.();
      }
      // Reset stop timer
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTypingStop?.();
      }, 2000);
    }, [isTyping, onTypingStart, onTypingStop]);

    const handleChange = useCallback(
      (e: ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= MAX_CHARS) {
          setValue(newValue);
          if (newValue.length > 0) {
            handleTypingStart();
          }
        }
      },
      [handleTypingStart],
    );

    const handleSend = useCallback(() => {
      const trimmed = value.trim();
      if (!trimmed) return;

      if (editingMessage) {
        onEditSend?.(editingMessage.id, trimmed);
        setEditingMessage(null);
      } else {
        onSend(trimmed, replyingTo ? { threadId: replyingTo.id, isThreadStarter: false } : undefined);
        setReplyingTo(null);
      }

      setValue('');
      setIsTyping(false);
      onTypingStop?.();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Reset height
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      });
    }, [value, editingMessage, replyingTo, onSend, onEditSend, onTypingStop, setEditingMessage, setReplyingTo]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
      [handleSend],
    );

    const handleCancel = useCallback(() => {
      if (editingMessage) {
        setEditingMessage(null);
      } else {
        setReplyingTo(null);
      }
      setValue('');
    }, [editingMessage, setEditingMessage, setReplyingTo]);

    // Set ref
    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );

    const placeholder = partnerName
      ? `Message ${partnerName}...`
      : 'Type a message...';

    return (
      <div className="border-t border-border bg-surface px-4 py-3">
        {/* Reply / Edit banner */}
        {(replyingTo || editingMessage) && (
          <div className="flex items-center gap-2 mb-2 rounded-lg bg-surface-hover px-3 py-2 text-sm">
            {editingMessage ? (
              <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <div className="h-full w-0.5 rounded-full bg-primary shrink-0 self-stretch" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">
                {editingMessage ? 'Editing message' : 'Replying to'}
              </p>
              <p className="text-xs text-text-muted truncate">
                {(editingMessage || replyingTo)?.content}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="shrink-0 p-1 rounded-full hover:bg-surface-active text-text-muted hover:text-text transition-colors"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div
            className="flex-1 relative"
            style={{
              borderRadius: 'var(--chat-input-radius)',
            }}
          >
            <textarea
              ref={setRefs}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                'w-full resize-none bg-background-alt text-text placeholder:text-text-muted',
                'px-4 py-2.5 text-sm leading-relaxed',
                'border border-border focus:border-border-focus focus:ring-2 focus:ring-border-focus/20',
                'focus:outline-none transition-all disabled:opacity-50',
              )}
              style={{
                borderRadius: 'var(--chat-input-radius)',
                minHeight: 'var(--chat-input-height)',
                maxHeight: 'var(--chat-input-max-height)',
              }}
              aria-label={placeholder}
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className={cn(
              'flex items-center justify-center shrink-0 rounded-full',
              'w-10 h-10 transition-all',
              value.trim()
                ? 'bg-primary text-text-on-primary hover:bg-primary-hover shadow-sm'
                : 'bg-surface-hover text-text-muted cursor-not-allowed',
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Character count (near limit) */}
        {value.length > MAX_CHARS * 0.9 && (
          <p
            className={cn(
              'text-xs mt-1 text-right',
              value.length >= MAX_CHARS ? 'text-error' : 'text-text-muted',
            )}
          >
            {value.length}/{MAX_CHARS}
          </p>
        )}
      </div>
    );
  },
);

MessageInput.displayName = 'MessageInput';
