'use client';

// Instagram-style feed card for one circle post: header (circle avatar + @handle
// linking to the profile), media (single, carousel, or video), an optimistic like
// toggle, a comment toggle, like/comment counts, the caption, and an expandable
// comments section. Stays in sync with the shared socket for live like updates.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';
import { timeAgo } from '@linkup/utils';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import { CommentsSection } from './comments-section';
import type { CirclePost } from './types';

interface FeedPostCardProps {
  post: CirclePost;
  /** Bubble like/comment count changes up so a parent feed list can persist them. */
  onUpdate?: (postId: string, patch: Partial<CirclePost>) => void;
  className?: string;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}

export function FeedPostCard({ post, onUpdate, className }: FeedPostCardProps) {
  // Route key: prefer the @handle, fall back to the circle id.
  const routeKey = post.circle?.handle ?? post.circleId;
  const profileHref = `/circles/${encodeURIComponent(routeKey)}`;
  const displayHandle = post.circle?.handle
    ? `@${post.circle.handle}`
    : post.circle?.name ?? post.authorName ?? 'Circle';

  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [liking, setLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [slide, setSlide] = useState(0);

  const media = post.mediaUrls ?? [];
  const isCarousel = media.length > 1;

  // Keep local state in lockstep if the parent hands us a fresh post object.
  useEffect(() => {
    setLiked(post.likedByMe);
    setLikeCount(post.likeCount);
    setCommentCount(post.commentCount);
  }, [post.likedByMe, post.likeCount, post.commentCount]);

  // Live like updates for THIS post (someone else liked/unliked).
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleLiked = (payload: {
      postId: string;
      liked: boolean;
      likeCount: number;
    }) => {
      if (payload.postId !== post.id) return;
      setLikeCount(payload.likeCount);
      onUpdate?.(post.id, { likeCount: payload.likeCount });
    };
    socket.on('circle:post:liked', handleLiked);
    return () => {
      socket.off('circle:post:liked', handleLiked);
    };
  }, [post.id, onUpdate]);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    // Optimistic.
    setLiked(nextLiked);
    setLikeCount(nextCount);
    onUpdate?.(post.id, { likedByMe: nextLiked, likeCount: nextCount });
    try {
      const res = await circlesApi.toggleLike(routeKey, post.id);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
      onUpdate?.(post.id, { likedByMe: res.liked, likeCount: res.likeCount });
    } catch {
      // Roll back.
      setLiked(prevLiked);
      setLikeCount(prevCount);
      onUpdate?.(post.id, { likedByMe: prevLiked, likeCount: prevCount });
    } finally {
      setLiking(false);
    }
  };

  const bumpCommentCount = () => {
    setCommentCount((c) => {
      const next = c + 1;
      onUpdate?.(post.id, { commentCount: next });
      return next;
    });
  };

  const goPrev = () => setSlide((s) => Math.max(0, s - 1));
  const goNext = () => setSlide((s) => Math.min(media.length - 1, s + 1));

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-surface',
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={profileHref} className="shrink-0">
          <Avatar
            size="md"
            src={post.circle?.avatarUrl ?? post.authorAvatarUrl}
            name={post.circle?.name ?? post.authorName ?? 'Circle'}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={profileHref}
            className="block truncate text-sm font-semibold text-text transition-colors hover:text-primary"
          >
            {displayHandle}
          </Link>
          <p className="text-xs text-text-muted">{timeAgo(post.createdAt)}</p>
        </div>
      </header>

      {/* Media */}
      {media.length > 0 && (
        <div className="relative aspect-square w-full overflow-hidden bg-background">
          <div
            className="flex h-full w-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {media.map((url, i) =>
              isVideoUrl(url) ? (
                <video
                  key={`${post.id}-m-${i}`}
                  src={url}
                  controls
                  playsInline
                  className="h-full w-full shrink-0 object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${post.id}-m-${i}`}
                  src={url}
                  alt={post.caption ? post.caption : 'Post media'}
                  className="h-full w-full shrink-0 object-cover"
                  loading="lazy"
                />
              ),
            )}
          </div>

          {isCarousel && (
            <>
              {slide > 0 && (
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 text-text backdrop-blur transition-colors hover:bg-background"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {slide < media.length - 1 && (
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 text-text backdrop-blur transition-colors hover:bg-background"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                {media.map((_, i) => (
                  <span
                    key={`dot-${i}`}
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-all',
                      i === slide ? 'bg-primary' : 'bg-text-muted/50',
                    )}
                  />
                ))}
              </div>
              <div className="absolute right-3 top-3 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium text-text backdrop-blur">
                {slide + 1}/{media.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <button
          type="button"
          onClick={handleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm transition-colors',
            liked ? 'text-error' : 'text-text-muted hover:text-text',
          )}
        >
          <Heart
            className={cn(
              'h-6 w-6 transition-transform active:scale-90',
              liked && 'fill-current',
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          aria-expanded={showComments}
          aria-label="Comments"
          className={cn(
            'inline-flex items-center gap-1.5 text-sm transition-colors',
            showComments ? 'text-primary' : 'text-text-muted hover:text-text',
          )}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>

      {/* Counts + caption */}
      <div className="space-y-1 px-4 pb-4 pt-2">
        {likeCount > 0 && (
          <p className="text-sm font-semibold text-text">
            <span className="font-mono">{likeCount}</span>{' '}
            {likeCount === 1 ? 'like' : 'likes'}
          </p>
        )}

        {post.caption && (
          <p className="whitespace-pre-wrap break-words text-sm text-text">
            <Link
              href={profileHref}
              className="mr-1.5 font-semibold text-text transition-colors hover:text-primary"
            >
              {displayHandle}
            </Link>
            {post.caption}
          </p>
        )}

        {commentCount > 0 && !showComments && (
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="text-sm text-text-muted transition-colors hover:text-text"
          >
            View {commentCount === 1 ? '1 comment' : `all ${commentCount} comments`}
          </button>
        )}

        {showComments && (
          <CommentsSection
            circleIdOrHandle={routeKey}
            postId={post.id}
            onCommentAdded={bumpCommentCount}
            className="mt-2"
          />
        )}
      </div>
    </article>
  );
}
