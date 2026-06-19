'use client';

import { Music2, SkipBack, SkipForward, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Track } from './types';

/** Formats a duration in seconds as m:ss for display. */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface PlayerBarProps {
  track: Track;
  isPlaying: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Called when the underlying <audio> element fires play/pause/ended. */
  onAudioPlay?: () => void;
  onAudioPause?: () => void;
  onAudioEnded?: () => void;
}

/**
 * Sticky player bar. Renders a small YouTube iframe for `youtube` sources
 * (audio-only sources can't be controlled cross-origin, so we autoplay) or a
 * native <audio> element for direct `url` sources.
 */
export function PlayerBar({
  track,
  isPlaying,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
}: PlayerBarProps) {
  const isYouTube = track.source === 'youtube' && !!track.sourceId;
  const isAudio = track.source === 'url' && !!track.url;

  return (
    <div className="sticky bottom-0 z-20 mt-4 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Now-playing info */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary-light">
            {track.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={track.coverUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Music2 className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">
              {track.title}
            </p>
            <p className="truncate text-xs text-text-muted">
              {track.artist || (isYouTube ? 'YouTube' : 'Audio')}
              {track.duration != null && (
                <span className="ml-2 font-mono">
                  {formatDuration(track.duration)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Media element */}
        <div className="flex items-center gap-3">
          {isYouTube && (
            <iframe
              key={track.sourceId}
              title={track.title}
              className="h-[72px] w-[128px] shrink-0 rounded-lg border border-border"
              src={`https://www.youtube.com/embed/${track.sourceId}?autoplay=1&enablejsapi=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          )}
          {isAudio && (
            <audio
              key={track.url}
              controls
              autoPlay
              className="h-9 w-full max-w-[260px]"
              src={track.url ?? undefined}
              onPlay={onAudioPlay}
              onPause={onAudioPause}
              onEnded={onAudioEnded}
            />
          )}
        </div>

        {/* Transport controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isPlaying ? 'bg-success' : 'bg-text-muted/50',
            )}
            aria-hidden="true"
          />
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            onClick={onClose}
            aria-label="Close player"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
