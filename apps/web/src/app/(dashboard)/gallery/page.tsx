'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Flame, Heart, Image as ImageIcon, Folder, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useMediaStore } from '@/stores/media-store';
import { UploadDropzone, MediaGrid, MediaLightbox, AlbumCard } from '@/components/media';
import { Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';

export default function GalleryPage() {
  const couple = useAuthStore((s) => s.couple);
  const coupleId = couple?.id;

  const {
    items,
    total,
    isLoading,
    hasMore,
    albums,
    isLoadingAlbums,
    activeTab,
    streakFilter,
    favoriteFilter,
    albumFilter,
    setActiveTab,
    setStreakFilter,
    setFavoriteFilter,
    setAlbumFilter,
    fetchMedia,
    fetchAlbums,
    openLightbox,
  } = useMediaStore();

  const [showUpload, setShowUpload] = useState(false);
  const [showNewAlbum, setShowNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const createAlbum = useMediaStore((s) => s.createAlbum);

  // Initial data fetch
  useEffect(() => {
    if (!coupleId) return;
    fetchMedia(coupleId);
    fetchAlbums(coupleId);
  }, [coupleId, fetchMedia, fetchAlbums]);

  // Refetch when filters change
  useEffect(() => {
    if (!coupleId) return;
    fetchMedia(coupleId);
  }, [coupleId, streakFilter, favoriteFilter, albumFilter, fetchMedia]);

  const handleLoadMore = useCallback(() => {
    if (!coupleId || isLoading || !hasMore) return;
    fetchMedia(coupleId, items.length);
  }, [coupleId, isLoading, hasMore, items.length, fetchMedia]);

  const handleAlbumClick = useCallback(
    (albumId: string) => {
      if (albumFilter === albumId) {
        setAlbumFilter(null);
        setActiveTab('all');
      } else {
        setAlbumFilter(albumId);
        setActiveTab('all');
      }
    },
    [albumFilter, setAlbumFilter, setActiveTab],
  );

  const handleCreateAlbum = useCallback(async () => {
    if (!coupleId || !newAlbumName.trim()) return;
    await createAlbum(coupleId, {
      name: newAlbumName.trim(),
      description: newAlbumDesc.trim() || undefined,
    });
    setNewAlbumName('');
    setNewAlbumDesc('');
    setShowNewAlbum(false);
  }, [coupleId, newAlbumName, newAlbumDesc, createAlbum]);

  // Not paired state
  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-active mb-4">
          <ImageIcon className="h-7 w-7 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text">No gallery yet</h2>
        <p className="mt-1 text-sm text-text-muted max-w-sm">
          Link up with your partner to start sharing photos and creating memories together.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Shared Memories
          </p>
          <h1 className="text-2xl font-bold text-text">Gallery</h1>
          <p className="text-sm text-text-muted">
            <span className="font-mono tabular-nums">{total}</span> photo{total !== 1 ? 's' : ''} ·{' '}
            <span className="font-mono tabular-nums">{albums.length}</span> album{albums.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
          >
            <Plus className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Upload dropzone (toggleable) */}
      {showUpload && coupleId && (
        <UploadDropzone
          coupleId={coupleId}
          albumId={albumFilter ?? undefined}
          onUploadComplete={() => {
            // Media store already updates items optimistically
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        <button
          onClick={() => {
            setActiveTab('all');
            setAlbumFilter(null);
          }}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'all' && !albumFilter
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text',
          )}
        >
          <ImageIcon className="h-4 w-4" />
          All Photos
          <span className="font-mono text-xs tabular-nums text-text-muted">({total})</span>
        </button>
        <button
          onClick={() => setActiveTab('albums')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            activeTab === 'albums'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text',
          )}
        >
          <Folder className="h-4 w-4" />
          Albums
          <span className="font-mono text-xs tabular-nums text-text-muted">({albums.length})</span>
        </button>
      </div>

      {/* Filter chips (only for 'all' tab) */}
      {activeTab === 'all' && (
        <div className="flex flex-wrap items-center gap-2">
          {albumFilter && (
            <button
              onClick={() => setAlbumFilter(null)}
              className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary border border-primary/20"
            >
              <Folder className="h-3 w-3" />
              {albums.find((a) => a.id === albumFilter)?.name ?? 'Album'}
              <X className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => setStreakFilter(!streakFilter)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              streakFilter
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-surface text-text-muted border-border hover:bg-surface-hover',
            )}
          >
            <Flame className="h-3 w-3" />
            Streak Photos
          </button>
          <button
            onClick={() => setFavoriteFilter(!favoriteFilter)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
              favoriteFilter
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-surface text-text-muted border-border hover:bg-surface-hover',
            )}
          >
            <Heart className="h-3 w-3" />
            Favorites
          </button>
        </div>
      )}

      {/* Content */}
      {activeTab === 'all' || albumFilter ? (
        <>
          {isLoading && items.length === 0 ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              <MediaGrid
                items={items}
                onItemClick={(_, index) => openLightbox(index)}
              />

              {hasMore && items.length > 0 && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    loading={isLoading}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        // Albums tab
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              <span className="font-mono tabular-nums">{albums.length}</span> album{albums.length !== 1 ? 's' : ''}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewAlbum(!showNewAlbum)}
            >
              <Plus className="h-4 w-4" />
              New Album
            </Button>
          </div>

          {/* New album form */}
          {showNewAlbum && (
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Album name"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
                autoFocus
              />
              <input
                type="text"
                value={newAlbumDesc}
                onChange={(e) => setNewAlbumDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateAlbum}
                  disabled={!newAlbumName.trim()}
                >
                  Create
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNewAlbum(false);
                    setNewAlbumName('');
                    setNewAlbumDesc('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isLoadingAlbums ? (
            <div className="flex justify-center py-10">
              <Spinner size="md" />
            </div>
          ) : albums.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Folder className="h-10 w-10 text-text-muted/30 mb-3" />
              <p className="text-sm font-medium text-text">No albums yet</p>
              <p className="mt-1 text-xs text-text-muted">
                Create your first album to organize your photos
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {albums.map((album) => (
                <AlbumCard
                  key={album.id}
                  album={album}
                  onClick={() => handleAlbumClick(album.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      <MediaLightbox />
    </div>
  );
}
