'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMediaStore, type MediaItem } from '@/stores/media-store';

export function MediaLightbox() {
  const lightboxIndex = useMediaStore((s) => s.lightboxIndex);
  const items = useMediaStore((s) => s.items);
  const closeLightbox = useMediaStore((s) => s.closeLightbox);
  const lightboxNext = useMediaStore((s) => s.lightboxNext);
  const lightboxPrev = useMediaStore((s) => s.lightboxPrev);
  const toggleFavorite = useMediaStore((s) => s.toggleFavorite);
  const deleteMedia = useMediaStore((s) => s.deleteMedia);

  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  const isOpen = lightboxIndex !== null;
  const currentItem: MediaItem | undefined =
    lightboxIndex !== null ? items[lightboxIndex] : undefined;

  // Reset zoom and pan when item changes
  useEffect(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [lightboxIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeLightbox();
          break;
        case 'ArrowLeft':
          lightboxPrev();
          break;
        case 'ArrowRight':
          lightboxNext();
          break;
        case '+':
        case '=':
          setZoom((z) => Math.min(z + 0.5, 5));
          break;
        case '-':
          setZoom((z) => Math.max(z - 0.5, 0.5));
          break;
        case '0':
          setZoom(1);
          setPanOffset({ x: 0, y: 0 });
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeLightbox, lightboxNext, lightboxPrev]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...panOffset };
    },
    [zoom, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPanOffset({
        x: panStart.current.x + dx,
        y: panStart.current.y + dy,
      });
    },
    [isDragging],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom((z) => Math.max(0.5, Math.min(5, z + delta)));
  }, []);

  const handleDownload = useCallback(() => {
    if (!currentItem?.cdnUrl) return;
    const a = document.createElement('a');
    a.href = currentItem.cdnUrl;
    a.download = currentItem.originalFilename;
    a.click();
  }, [currentItem]);

  const handleDelete = useCallback(() => {
    if (!currentItem) return;
    deleteMedia(currentItem.id);
    if (items.length <= 1) {
      closeLightbox();
    } else if (lightboxIndex !== null && lightboxIndex >= items.length - 1) {
      lightboxPrev();
    }
  }, [currentItem, items.length, lightboxIndex, deleteMedia, closeLightbox, lightboxPrev]);

  if (!isOpen || !currentItem) return null;

  const isVideo = currentItem.type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={closeLightbox}
      />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/80">
            {(lightboxIndex ?? 0) + 1} / {items.length}
          </span>
          <span className="text-sm text-white/60 truncate max-w-60">
            {currentItem.originalFilename}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFavorite(currentItem.id)}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
              currentItem.isFavorite
                ? 'text-primary hover:text-primary/80'
                : 'text-white/70 hover:text-white',
            )}
            title="Favorite"
          >
            <Heart
              className="h-5 w-5"
              fill={currentItem.isFavorite ? 'currentColor' : 'none'}
            />
          </button>

          <button
            onClick={handleDownload}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>

          <button
            onClick={handleDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-error transition-colors"
            title="Delete"
          >
            <Trash2 className="h-5 w-5" />
          </button>

          <button
            onClick={closeLightbox}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 hover:text-white transition-colors ml-2"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              lightboxPrev();
            }}
            className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              lightboxNext();
            }}
            className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition-colors backdrop-blur-sm"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Content */}
      <div
        className={cn(
          'relative max-h-[85vh] max-w-[90vw] select-none',
          zoom > 1 ? 'cursor-grab' : 'cursor-default',
          isDragging && 'cursor-grabbing',
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {isVideo ? (
          <video
            key={currentItem.id}
            src={currentItem.cdnUrl ?? undefined}
            controls
            autoPlay
            className="max-h-[85vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          <img
            key={currentItem.id}
            src={currentItem.cdnUrl ?? undefined}
            alt={currentItem.originalFilename}
            className="max-h-[85vh] max-w-[90vw] rounded-lg transition-transform duration-150"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Bottom bar — zoom controls */}
      {!isVideo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur-sm">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs text-white/80 min-w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(5, z + 0.5))}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPanOffset({ x: 0, y: 0 });
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:text-white transition-colors"
            title="Reset zoom"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Caption */}
      {currentItem.caption && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 max-w-lg rounded-lg bg-black/50 px-4 py-2 backdrop-blur-sm">
          <p className="text-sm text-white/90 text-center">
            {currentItem.caption}
          </p>
        </div>
      )}
    </div>
  );
}
