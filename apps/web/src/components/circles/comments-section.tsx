'use client';

// Comments list + add-comment for a single circle post. Self-contained: fetches
// its own page of comments via getComments, posts new ones via addComment, and
// merges live `circle:comment:new` socket payloads. Expandable — the host (e.g.
// FeedPostCard) mounts this when the viewer opens comments.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar, Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { timeAgo } from '@linkup/utils';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import type { Comment } from './types';

interface CommentsSectionProps {
  /** UUID or @handle of the circle that owns the post (route key). */
  circleIdOrHandle: string;
  postId: string;
  /** Bump the host's comment count by one whenever a comment is added/received. */
  onCommentAdded?: () => void;
  className?: string;
}

export function CommentsSection({
  circleIdOrHandle,
  postId,
  onCommentAdded,
  className,
}: CommentsSectionProps) {
  const user = useAuthStore((s) => s.user);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Track ids we've already rendered so live + optimistic + paged loads dedup.
  const seenIds = useRef<Set<string>>(new Set());

  const appendUnseen = useCallback((incoming: Comment[]) => {
    setComments((prev) => {
      const next = [...prev];
      for (const c of incoming) {
        if (!seenIds.current.has(c.id)) {
          seenIds.current.add(c.id);
          next.push(c);
        }
      }
      return next;
    });
  }, []);

  // Initial load (newest page; comments come oldest-first from the API).
  useEffect(() => {
    let cancelled = false;
    seenIds.current = new Set();
    setLoading(true);
    setComments([]);
    setNextCursor(null);
    circlesApi
      .getComments(circleIdOrHandle, postId)
      .then(({ comments: list, nextCursor: cursor }) => {
        if (cancelled) return;
        seenIds.current = new Set(list.map((c) => c.id));
        setComments(list);
        setNextCursor(cursor);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [circleIdOrHandle, postId]);

  // Live comments arriving for THIS post via the shared socket.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (payload: {
      postId: string;
      comment: Comment;
    }) => {
      if (payload.postId !== postId || !payload.comment) return;
      if (seenIds.current.has(payload.comment.id)) return;
      seenIds.current.add(payload.comment.id);
      setComments((prev) => [...prev, payload.comment]);
      onCommentAdded?.();
    };

    socket.on('circle:comment:new', handleNew);
    return () => {
      socket.off('circle:comment:new', handleNew);
    };
  }, [postId, onCommentAdded]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { comments: more, nextCursor: cursor } = await circlesApi.getComments(
        circleIdOrHandle,
        postId,
        { cursor: nextCursor },
      );
      appendUnseen(more);
      setNextCursor(cursor);
    } catch {
      // Silent — the existing list stays put.
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const { comment } = await circlesApi.addComment(
        circleIdOrHandle,
        postId,
        trimmed,
      );
      // The create response omits author joins — backfill from the signed-in user.
      const enriched: Comment = {
        ...comment,
        authorName: comment.authorName ?? user?.displayName ?? 'You',
        authorAvatarUrl: comment.authorAvatarUrl ?? user?.avatarUrl ?? null,
        authorUsername: comment.authorUsername ?? user?.username ?? null,
      };
      if (!seenIds.current.has(enriched.id)) {
        seenIds.current.add(enriched.id);
        setComments((prev) => [...prev, enriched]);
        onCommentAdded?.();
      }
      setDraft('');
    } catch (err: any) {
      useToastStore.getState().push({
        title: 'Could not comment',
        body:
          err?.response?.data?.error?.message ||
          'Something went wrong. Try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn('border-t border-border pt-3', className)}>
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          {nextCursor && (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="mb-3 text-xs font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'View earlier comments'}
            </button>
          )}

          {comments.length === 0 ? (
            <p className="py-2 text-center text-xs text-text-muted">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <Avatar
                    size="xs"
                    src={c.authorAvatarUrl}
                    name={c.authorName || 'Member'}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-xs font-semibold text-text">
                        {c.authorUsername
                          ? `@${c.authorUsername}`
                          : c.authorName || 'Member'}
                      </span>
                      <span className="shrink-0 text-[10px] text-text-muted">
                        {timeAgo(c.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-text">
                      {c.content}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          className="h-9 w-full rounded-full border border-border bg-transparent px-3 text-sm text-text placeholder:text-text-muted transition-all focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
        />
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          loading={submitting}
          disabled={!draft.trim()}
          aria-label="Post comment"
        >
          {!submitting && <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
