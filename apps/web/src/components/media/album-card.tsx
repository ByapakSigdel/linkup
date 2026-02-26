'use client';

import { Image as ImageIcon, Folder } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { MediaAlbum } from '@/stores/media-store';

interface AlbumCardProps {
  album: MediaAlbum;
  onClick?: () => void;
  className?: string;
}

export function AlbumCard({ album, onClick, className }: AlbumCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group cursor-pointer overflow-hidden rounded-xl border border-border bg-surface transition-all hover:shadow-md hover:border-primary/30',
        className,
      )}
    >
      {/* Cover image */}
      <div className="relative aspect-[4/3] bg-surface-active overflow-hidden">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Folder className="h-10 w-10 text-text-muted/30" />
          </div>
        )}

        {/* Photo count badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
          <ImageIcon className="h-3 w-3" />
          {album.mediaCount ?? 0}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-text">
          {album.name}
        </h3>
        {album.description && (
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {album.description}
          </p>
        )}
      </div>
    </div>
  );
}
