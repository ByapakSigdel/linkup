'use client';

import { useState } from 'react';
import { Copy, Check, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Badge } from '@/components/ui';

export interface CustomEmoji {
  id: string;
  name: string;
  imageUrl: string;
  category?: string;
  isAnimated?: boolean;
  useCount: number;
  createdAt: string;
}

interface EmojiCardProps {
  emoji: CustomEmoji;
  onCopy: (emoji: CustomEmoji) => void;
  onDelete: (emoji: CustomEmoji) => void;
  deleting?: boolean;
}

export function EmojiCard({ emoji, onCopy, onDelete, deleting }: EmojiCardProps) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleCopy = () => {
    onCopy(emoji);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 transition-all hover:border-border-strong hover:bg-surface-hover">
      {/* Delete (corner) */}
      {confirming ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/95 p-3 text-center">
          <p className="text-xs text-text">
            Delete <span className="font-medium">:{emoji.name}:</span>?
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              loading={deleting}
              onClick={() => onDelete(emoji)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="Delete emoji"
          className="absolute right-2 top-2 z-[1] flex h-7 w-7 items-center justify-center rounded-full text-text-muted opacity-0 transition-all hover:bg-error/15 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Animated badge */}
      {emoji.isAnimated && (
        <Badge
          variant="secondary"
          size="sm"
          className="absolute left-2 top-2 z-[1] gap-0.5"
        >
          <Sparkles className="h-2.5 w-2.5" />
          GIF
        </Badge>
      )}

      {/* Image */}
      <div className="flex h-16 w-16 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={emoji.imageUrl}
          alt={emoji.name}
          className="max-h-16 max-w-16 object-contain"
          loading="lazy"
        />
      </div>

      {/* Name */}
      <p className="max-w-full truncate text-center text-xs font-medium text-text">
        :{emoji.name}:
      </p>

      {/* Use count */}
      <p className="text-[11px] text-text-muted">
        used <span className="font-mono">{emoji.useCount}</span>{' '}
        {emoji.useCount === 1 ? 'time' : 'times'}
      </p>

      {/* Copy */}
      <Button
        variant={copied ? 'secondary' : 'outline'}
        size="sm"
        className="w-full"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Copied
          </>
        ) : (
          <>
            <Copy className={cn('h-3.5 w-3.5')} />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}
