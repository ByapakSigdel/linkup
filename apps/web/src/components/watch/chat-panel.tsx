'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { Button, Input, Emoji } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { ChatMessage } from './types';

export const WATCH_REACTIONS = ['😂', '❤️', '😮', '🔥', '👏', '😢'] as const;

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
  disabled?: boolean;
}

export function ChatPanel({
  messages,
  onSend,
  onReact,
  disabled,
}: ChatPanelProps) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-text">Watch chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-text-muted">
            Say something while you watch together.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}
            >
              <span className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                {m.mine ? 'You' : 'Partner'}
              </span>
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-1.5 text-sm',
                  m.mine
                    ? 'rounded-br-sm bg-primary text-text-on-primary'
                    : 'rounded-bl-sm bg-surface-hover text-text',
                )}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Reactions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
        {WATCH_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            disabled={disabled}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110 hover:bg-surface-hover disabled:opacity-40"
            aria-label={`React ${emoji}`}
          >
            <Emoji emoji={emoji} size={20} />
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? 'Start a party to chat' : 'Message…'}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          shape="pill"
          disabled={disabled || !text.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
