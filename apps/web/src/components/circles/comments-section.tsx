'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Avatar, Button, Spinner } from '@/components/ui';
import { timeAgo } from '@linkup/utils';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { CircleCommentView } from './types';

interface CommentsSectionProps {
  circleId: string;
  postId: string;
  /** Comments pushed in live via socket while this section is open. */
  liveComments: CircleCommentView[];
  /** Register a comment id so the parent can bump the count exactly once. */
  onCommentAdded: (commentId: string) => void;
}

export function CommentsSection({
  circleId,
  postId,
  liveComments,
  onCommentAdded,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<CircleCommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`/circles/${circleId}/posts/${postId}/comments`)
      .then(({ data }) => {
        if (cancelled) return;
        const list: CircleCommentView[] = data.data.comments ?? [];
        seenIds.current = new Set(list.map((c) => c.id));
        setComments(list);
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
  }, [circleId, postId]);

  // Merge in any live comments that arrived via socket (dedup by id).
  useEffect(() => {
    if (liveComments.length === 0) return;
    setComments((prev) => {
      const next = [...prev];
      for (const c of liveComments) {
        if (!seenIds.current.has(c.id)) {
          seenIds.current.add(c.id);
          next.push(c);
        }
      }
      return next;
    });
  }, [liveComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(
        `/circles/${circleId}/posts/${postId}/comments`,
        { content: trimmed },
      );
      const raw = data.data.comment;
      const comment: CircleCommentView = {
        id: raw.id,
        content: raw.content,
        userId: raw.userId,
        createdAt: raw.createdAt ?? new Date().toISOString(),
        authorName: raw.authorName ?? null,
        authorAvatarUrl: raw.authorAvatarUrl ?? null,
      };
      if (!seenIds.current.has(comment.id)) {
        seenIds.current.add(comment.id);
        setComments((prev) => [...prev, comment]);
      }
      setDraft('');
      onCommentAdded(comment.id);
    } catch (err: any) {
      useToastStore.getState().push({
        title: 'Could not comment',
        body:
          err.response?.data?.error?.message ||
          'Something went wrong. Try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      {loading ? (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
        </div>
      ) : comments.length === 0 ? (
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
              <div className="min-w-0 flex-1 rounded-lg bg-surface-hover px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-xs font-semibold text-text">
                    {c.authorName || 'Member'}
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

      <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a comment..."
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
          aria-label="Send comment"
        >
          {!submitting && <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
