'use client';

import { useState } from 'react';
import { Send, Megaphone, BarChart3, Calendar, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { CirclePostType, CirclePostView } from './types';

interface PostComposerProps {
  circleId: string;
  onPosted: (post: CirclePostView) => void;
}

const POST_TYPES: {
  value: CirclePostType;
  label: string;
  icon: typeof MessageSquare;
}[] = [
  { value: 'post', label: 'Post', icon: MessageSquare },
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'poll', label: 'Poll', icon: BarChart3 },
  { value: 'event', label: 'Event', icon: Calendar },
];

export function PostComposer({ circleId, onPosted }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<CirclePostType>('post');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/circles/${circleId}/posts`, {
        content: trimmed,
        type,
      });
      const raw = data.data.post;
      const post: CirclePostView = {
        id: raw.id,
        content: raw.content,
        type: raw.type ?? type,
        authorName: raw.authorName ?? null,
        authorAvatarUrl: raw.authorAvatarUrl ?? null,
        likeCount: raw.likeCount ?? 0,
        commentCount: raw.commentCount ?? 0,
        likedByMe: raw.likedByMe ?? false,
        createdAt: raw.createdAt ?? new Date().toISOString(),
        mediaUrls: raw.mediaUrls ?? [],
      };
      onPosted(post);
      setContent('');
      setType('post');
    } catch (err: any) {
      useToastStore.getState().push({
        title: 'Could not post',
        body:
          err.response?.data?.error?.message ||
          'Something went wrong. Try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-4"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share something with your circle..."
        rows={3}
        maxLength={1000}
        className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted transition-all focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {POST_TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-transparent text-text-muted hover:bg-surface-hover',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <Button
          type="submit"
          size="sm"
          loading={submitting}
          disabled={!content.trim()}
        >
          <Send className="h-4 w-4" />
          Post
        </Button>
      </div>
    </form>
  );
}
