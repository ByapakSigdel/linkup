'use client';

import { useState } from 'react';
import { Trash2, Loader2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Emoji } from '@/components/ui';

export interface BoardSound {
  id: string;
  name: string;
  audioUrl: string;
  emoji?: string;
  category?: string;
  color?: string;
  duration?: number;
  useCount: number;
}

interface SoundPadProps {
  sound: BoardSound;
  onPlay: (sound: BoardSound) => void;
  onDelete: (sound: BoardSound) => void;
  playing?: boolean;
  deleting?: boolean;
}

const DEFAULT_COLOR = '#C4A8E0';

/** Build a soft tinted background + readable border from a hex color. */
function tint(color: string) {
  return {
    backgroundColor: `${color}22`,
    borderColor: `${color}55`,
  };
}

export function SoundPad({
  sound,
  onPlay,
  onDelete,
  playing,
  deleting,
}: SoundPadProps) {
  const [confirming, setConfirming] = useState(false);
  const color = sound.color || DEFAULT_COLOR;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onPlay(sound)}
        style={tint(color)}
        className={cn(
          'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition-all',
          'hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95',
          playing && 'ring-2 ring-offset-2 ring-offset-background animate-pulse',
        )}
      >
        <Emoji
          emoji={sound.emoji || '🔊'}
          size={40}
          label={sound.name}
          className="leading-none"
        />
        <span className="line-clamp-2 max-w-full text-xs font-medium text-text">
          {sound.name}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-text-muted">
          {playing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              playing
            </>
          ) : (
            <>
              <Volume2 className="h-3 w-3" />
              <span className="font-mono">{sound.useCount}</span>
            </>
          )}
        </span>
      </button>

      {/* Delete */}
      {confirming ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/95 p-2 text-center">
          <p className="text-[11px] text-text">Delete this sound?</p>
          <div className="flex gap-1.5">
            <Button
              variant="destructive"
              size="sm"
              loading={deleting}
              onClick={() => onDelete(sound)}
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
          title="Delete sound"
          className="absolute right-1.5 top-1.5 z-[1] flex h-6 w-6 items-center justify-center rounded-full bg-background/70 text-text-muted opacity-0 transition-all hover:bg-error/20 hover:text-error focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
