'use client';

import { useState } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Music2,
  Youtube,
  Link2,
  Pause,
} from 'lucide-react';
import { Button, Input, Spinner, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { extractYouTubeId, youTubeWatchUrl } from './youtube';
import type { Track, PlaylistDetail } from './types';

/** Formats a duration in seconds as m:ss for display. */
function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface NewTrackInput {
  title: string;
  artist?: string;
  source: 'youtube' | 'url';
  sourceId?: string;
  url?: string;
}

interface TrackPanelProps {
  playlist: PlaylistDetail | null;
  tracks: Track[];
  loading: boolean;
  adding: boolean;
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlay: (track: Track) => void;
  onAddTrack: (input: NewTrackInput) => Promise<void> | void;
  onDeleteTrack: (trackId: string) => void;
  onDeletePlaylist: () => void;
}

export function TrackPanel({
  playlist,
  tracks,
  loading,
  adding,
  currentTrackId,
  isPlaying,
  onPlay,
  onAddTrack,
  onDeleteTrack,
  onDeletePlaylist,
}: TrackPanelProps) {
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const raw = link.trim();
    if (!raw) {
      setError('Paste a YouTube link or a direct audio URL.');
      return;
    }

    const ytId = extractYouTubeId(raw);
    if (ytId) {
      onAddTrack({
        title: title.trim() || 'YouTube track',
        artist: artist.trim() || undefined,
        source: 'youtube',
        sourceId: ytId,
        url: youTubeWatchUrl(ytId),
      });
    } else {
      // Treat as a direct audio URL.
      let valid = false;
      try {
        const u = new URL(raw);
        valid = u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        valid = false;
      }
      if (!valid) {
        setError('That does not look like a YouTube link or a valid audio URL.');
        return;
      }
      if (!title.trim()) {
        setError('A title is required for direct audio URLs.');
        return;
      }
      onAddTrack({
        title: title.trim(),
        artist: artist.trim() || undefined,
        source: 'url',
        url: raw,
      });
    }

    setLink('');
    setTitle('');
    setArtist('');
  }

  if (!playlist) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 py-20 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-active">
          <Music2 className="h-6 w-6 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text">Select a playlist</p>
        <p className="mt-1 max-w-xs text-sm text-text-muted">
          Pick a playlist on the left, or create a new one to start adding songs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-border bg-surface">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-text">
            {playlist.name}
          </h2>
          {playlist.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-text-muted">
              {playlist.description}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-text-muted">
              {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          onClick={onDeletePlaylist}
          aria-label="Delete playlist"
          title="Delete playlist"
        >
          <Trash2 className="h-4 w-4 text-error" />
        </Button>
      </div>

      {/* Add track form */}
      <form
        onSubmit={handleAdd}
        className="space-y-2 border-b border-border bg-surface-hover/40 p-4"
      >
        <Input
          placeholder="Paste a YouTube link or direct audio URL"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          error={error ?? undefined}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Title (optional for YouTube)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Artist (optional)"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" loading={adding} className="shrink-0">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </form>

      {/* Tracks */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : tracks.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-text-muted">
            No tracks yet. Paste a song above to get started.
          </div>
        ) : (
          <ul className="space-y-1">
            {tracks.map((track, idx) => {
              const isCurrent = track.id === currentTrackId;
              return (
                <li
                  key={track.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                    isCurrent ? 'bg-primary-light' : 'hover:bg-surface-hover',
                  )}
                >
                  <button
                    onClick={() => onPlay(track)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-active text-text-muted transition-colors hover:bg-primary hover:text-text-on-primary"
                    aria-label={`Play ${track.title}`}
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <span className="w-5 shrink-0 text-center font-mono text-xs text-text-muted">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        isCurrent ? 'text-primary' : 'text-text',
                      )}
                    >
                      {track.title}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {track.artist || 'Unknown artist'}
                    </p>
                  </div>
                  {track.duration != null && (
                    <span className="hidden shrink-0 font-mono text-xs text-text-muted sm:inline">
                      {formatDuration(track.duration)}
                    </span>
                  )}
                  <Badge variant="outline" size="sm" className="hidden gap-1 sm:inline-flex">
                    {track.source === 'youtube' ? (
                      <Youtube className="h-3 w-3" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    {track.source === 'youtube' ? 'YouTube' : 'Audio'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    shape="pill"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => onDeleteTrack(track.id)}
                    aria-label={`Remove ${track.title}`}
                  >
                    <Trash2 className="h-4 w-4 text-text-muted" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
