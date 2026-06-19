'use client';

import { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Megaphone,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { timeAgo } from '@linkup/utils';
import api from '@/lib/api';
import { CommentsSection } from './comments-section';
import type { CircleCommentView, CirclePostView } from './types';

interface PostCardProps {
  circleId: string;
  post: CirclePostView;
  /** Live comments for THIS post received via socket. */
  liveComments: CircleCommentView[];
  /** Patch the post in the parent feed (like count, comment count, etc.). */
  onUpdate: (patch: Partial<CirclePostView>) => void;
  /** Register a comment id with the parent so it bumps the count once. */
  onCommentRegistered: (postId: string, commentId: string) => void;
}

const TYPE_META: Record<
  string,
  { label: string; icon: typeof Megaphone; variant: 'default' | 'secondary' | 'warning' }
> = {
  announcement: { label: 'Announcement', icon: Megaphone, variant: 'warning' },
  poll: { label: 'Poll', icon: BarChart3, variant: 'secondary' },
  event: { label: 'Event', icon: Calendar, variant: 'default' },
};

export function PostCard({
  circleId,
  post,
  liveComments,
  onUpdate,
  onCommentRegistered,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);

  const meta = TYPE_META[post.type];

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    // Optimistic toggle.
    const prevLiked = post.likedByMe;
    const prevCount = post.likeCount;
    const nextLiked = !prevLiked;
    onUpdate({
      likedByMe: nextLiked,
      likeCount: Math.max(0, prevCount + (nextLiked ? 1 : -1)),
    });
    try {
      const { data } = await api.post(
        `/circles/${circleId}/posts/${post.id}/like`,
      );
      onUpdate({
        likedByMe: data.data.liked,
        likeCount: data.data.likeCount,
      });
    } catch {
      // Roll back on failure.
      onUpdate({ likedByMe: prevLiked, likeCount: prevCount });
    } finally {
      setLiking(false);
    }
  };

  return (
    <article className="rounded-lg border border-border bg-surface p-4">
      {/* Author row */}
      <div className="flex items-center gap-3">
        <Avatar
          size="md"
          src={post.authorAvatarUrl}
          name={post.authorName || 'Member'}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text">
            {post.authorName || 'Member'}
          </p>
          <p className="text-xs text-text-muted">{timeAgo(post.createdAt)}</p>
        </div>
        {meta && (
          <Badge variant={meta.variant} size="sm" className="gap-1">
            <meta.icon className="h-3 w-3" />
            {meta.label}
          </Badge>
        )}
      </div>

      {/* Content */}
      <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text">
        {post.content}
      </p>

      {/* Media */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {post.mediaUrls.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${post.id}-media-${i}`}
              src={url}
              alt="Post media"
              className="h-40 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={handleLike}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm transition-colors',
            post.likedByMe
              ? 'text-error'
              : 'text-text-muted hover:text-text',
          )}
          aria-pressed={post.likedByMe}
        >
          <Heart
            className={cn('h-4 w-4', post.likedByMe && 'fill-current')}
          />
          <span className="font-mono">{post.likeCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowComments((s) => !s)}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm transition-colors',
            showComments ? 'text-primary' : 'text-text-muted hover:text-text',
          )}
          aria-expanded={showComments}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="font-mono">{post.commentCount}</span>
        </button>
      </div>

      {showComments && (
        <CommentsSection
          circleId={circleId}
          postId={post.id}
          liveComments={liveComments}
          onCommentAdded={(commentId) =>
            onCommentRegistered(post.id, commentId)
          }
        />
      )}
    </article>
  );
}
