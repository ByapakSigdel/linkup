'use client';

// PostGrid — Instagram-style 3-column thumbnail grid of a circle's posts.
// Clicking a thumbnail opens a lightbox modal showing the full media (with
// carousel paging for multi-photo posts), the caption, and like/comment counts.
// Presentational: posts are passed in by the parent (profile page).

import { useCallback, useEffect, useState } from 'react';
import {
  Heart,
  MessageCircle,
  X,
  Copy,
  ChevronLeft,
  ChevronRight,
  ImageOff,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui';
import type { CirclePost } from '@/components/circles/types';

export interface PostGridProps {
  posts: CirclePost[];
  /** Show a loading state for the initial fetch. */
  loading?: boolean;
  /** Optional empty-state copy. */
  emptyLabel?: string;
  className?: string;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

function PostMedia({
  url,
  className,
  controls = false,
}: {
  url: string;
  className?: string;
  controls?: boolean;
}) {
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        className={className}
        controls={controls}
        muted={!controls}
        playsInline
        loop={!controls}
        preload="metadata"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} />;
}

function GridThumb({
  post,
  onOpen,
}: {
  post: CirclePost;
  onOpen: () => void;
}) {
  const cover = post.mediaUrls[0];
  const isMulti = post.mediaUrls.length > 1;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden bg-surface-active focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      aria-label="Open post"
    >
      {cover ? (
        <PostMedia
          url={cover}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-text-muted">
          <ImageOff className="h-6 w-6" />
        </span>
      )}

      {/* Multi-photo indicator */}
      {isMulti && (
        <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
          <Copy className="h-4 w-4 -scale-x-100" />
        </span>
      )}

      {/* Hover overlay with like/comment counts */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-5 bg-black/40 text-sm font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="flex items-center gap-1.5">
          <Heart className="h-5 w-5 fill-white" />
          {post.likeCount}
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="h-5 w-5 fill-white" />
          {post.commentCount}
        </span>
      </span>
    </button>
  );
}

function Lightbox({
  post,
  onClose,
}: {
  post: CirclePost;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const count = post.mediaUrls.length;

  const prev = useCallback(
    () => setIndex((i) => (i - 1 + count) % count),
    [count],
  );
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  // Keyboard: Esc closes, arrows page through carousel media.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && count > 1) prev();
      else if (e.key === 'ArrowRight' && count > 1) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, prev, next, count]);

  // Lock body scroll while open.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const current = post.mediaUrls[index];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/20 text-white transition-colors hover:bg-background/40"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media stage */}
        <div className="relative flex flex-1 items-center justify-center bg-black">
          {current ? (
            <PostMedia
              url={current}
              controls
              className="max-h-[55vh] w-full object-contain md:max-h-[88vh]"
            />
          ) : (
            <span className="flex h-64 w-full items-center justify-center text-white/60">
              <ImageOff className="h-8 w-8" />
            </span>
          )}

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/40 text-white transition-colors hover:bg-background/60"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={next}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/40 text-white transition-colors hover:bg-background/60"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                {post.mediaUrls.map((url, i) => (
                  <span
                    key={url}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-colors',
                      i === index ? 'bg-white' : 'bg-white/40',
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Details panel */}
        <div className="flex w-full shrink-0 flex-col gap-4 p-5 md:w-80">
          {post.caption ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">
              {post.caption}
            </p>
          ) : (
            <p className="text-sm italic text-text-muted">No caption</p>
          )}

          <div className="mt-auto flex items-center gap-5 border-t border-border pt-4 text-sm text-text">
            <span className="flex items-center gap-1.5">
              <Heart
                className={cn(
                  'h-5 w-5',
                  post.likedByMe ? 'fill-primary text-primary' : 'text-text-muted',
                )}
              />
              <span className="font-medium">{post.likeCount}</span>
              <span className="text-text-muted">
                like{post.likeCount === 1 ? '' : 's'}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-5 w-5 text-text-muted" />
              <span className="font-medium">{post.commentCount}</span>
              <span className="text-text-muted">
                comment{post.commentCount === 1 ? '' : 's'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostGrid({
  posts,
  loading = false,
  emptyLabel = 'No posts yet',
  className,
}: PostGridProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openId) ?? null;

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" className="text-primary" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-active text-text-muted">
          <ImageOff className="h-6 w-6" />
        </span>
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn('grid grid-cols-3 gap-0.5 sm:gap-1', className)}>
        {posts.map((post) => (
          <GridThumb
            key={post.id}
            post={post}
            onOpen={() => setOpenId(post.id)}
          />
        ))}
      </div>

      {openPost && (
        <Lightbox post={openPost} onClose={() => setOpenId(null)} />
      )}
    </>
  );
}
