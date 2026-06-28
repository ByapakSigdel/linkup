'use client';

import { Heart, Play, Trash2, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMediaStore, type MediaItem } from '@/stores/media-store';

interface MediaGridProps {
  items: MediaItem[];
  onItemClick?: (item: MediaItem, index: number) => void;
  className?: string;
  columns?: 3 | 4;
  /** Read-only memorial mode: hides favorite/delete hover actions. */
  readOnly?: boolean;
}

export function MediaGrid({
  items,
  onItemClick,
  className,
  columns = 4,
  readOnly,
}: MediaGridProps) {
  const toggleFavorite = useMediaStore((s) => s.toggleFavorite);
  const deleteMedia = useMediaStore((s) => s.deleteMedia);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-active mb-4">
          <Heart className="h-7 w-7 text-text-muted" />
        </div>
        <p className="text-sm font-medium text-text">
          {readOnly ? 'No photos' : 'No photos yet'}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {readOnly
            ? 'There are no shared photos between you.'
            : 'Upload your first photo to start building your gallery'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid gap-1.5',
        columns === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item, index) => (
        <MediaGridItem
          key={item.id}
          item={item}
          onClick={() => onItemClick?.(item, index)}
          onToggleFavorite={() => toggleFavorite(item.id)}
          onDelete={() => deleteMedia(item.id)}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

interface MediaGridItemProps {
  item: MediaItem;
  onClick?: () => void;
  onToggleFavorite?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

function MediaGridItem({ item, onClick, onToggleFavorite, onDelete, readOnly }: MediaGridItemProps) {
  const isVideo = item.type === 'video';
  const isFavorite = item.isFavorite;
  const imageUrl = item.cdnUrl;

  return (
    <div
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-surface-active"
      onClick={onClick}
    >
      {imageUrl ? (
        isVideo ? (
          <video
            src={imageUrl}
            className="h-full w-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          <img
            src={imageUrl}
            alt={item.originalFilename}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Heart className="h-8 w-8 text-text-muted/30" />
        </div>
      )}

      {/* Video play overlay */}
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <Play className="h-5 w-5 ml-0.5" fill="white" />
          </div>
        </div>
      )}

      {/* Video duration */}
      {isVideo && item.duration && (
        <div className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
        </div>
      )}

      {/* Hover overlay with actions */}
      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />

      {/* Favorite / delete actions — hidden in read-only memorial mode. */}
      {!readOnly && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
              isFavorite
                ? 'bg-primary/90 text-white'
                : 'bg-black/40 text-white hover:bg-black/60',
            )}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className="h-3.5 w-3.5"
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-error/80"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Favorite indicator (always visible) */}
      {isFavorite && (
        <div className={cn('absolute top-1.5 left-1.5', !readOnly && 'group-hover:hidden')}>
          <Heart className="h-4 w-4 text-primary drop-shadow-md" fill="currentColor" />
        </div>
      )}
    </div>
  );
}
