// Comments list + add-comment for a single circle post. Ported from
// apps/web/src/components/circles/comments-section.tsx. Fetches its own page of
// comments, posts new ones, and merges live `circle:comment:new` socket payloads.

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Send } from 'lucide-react-native';
import { Avatar, AppText, Spinner, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import { timeAgo, errMessage } from './helpers';
import type { Comment } from './types';

interface CommentsSectionProps {
  circleIdOrHandle: string;
  postId: string;
  onCommentAdded?: () => void;
}

export function CommentsSection({
  circleIdOrHandle,
  postId,
  onCommentAdded,
}: CommentsSectionProps) {
  const { colors, radius } = useTheme();
  const user = useAuthStore((s) => s.user);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleNew = (payload: { postId: string; comment: Comment }) => {
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

  const handleSubmit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const { comment } = await circlesApi.addComment(
        circleIdOrHandle,
        postId,
        trimmed,
      );
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
    } catch (err) {
      useToastStore.getState().push({
        title: 'Could not comment',
        body: errMessage(err, 'Something went wrong. Try again.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 8 }}>
      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Spinner size="small" />
        </View>
      ) : (
        <>
          {nextCursor ? (
            <Pressable onPress={handleLoadMore} disabled={loadingMore} style={{ marginBottom: 12 }}>
              <AppText variant="caption" muted weight="600">
                {loadingMore ? 'Loading…' : 'View earlier comments'}
              </AppText>
            </Pressable>
          ) : null}

          {comments.length === 0 ? (
            <AppText variant="caption" muted center style={{ paddingVertical: 8 }}>
              No comments yet. Be the first to reply.
            </AppText>
          ) : (
            <View style={{ gap: 12 }}>
              {comments.map((c) => (
                <Row key={c.id} gap={8} style={{ alignItems: 'flex-start' }}>
                  <Avatar
                    uri={resolveMediaUrl(c.authorAvatarUrl)}
                    name={c.authorName || 'Member'}
                    size={28}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Row gap={6} style={{ alignItems: 'baseline' }}>
                      <AppText variant="caption" weight="700" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {c.authorUsername ? `@${c.authorUsername}` : c.authorName || 'Member'}
                      </AppText>
                      <AppText style={{ fontSize: 10 }} muted>
                        {timeAgo(c.createdAt)}
                      </AppText>
                    </Row>
                    <AppText variant="body" style={{ fontSize: 14 }}>
                      {c.content}
                    </AppText>
                  </View>
                </Row>
              ))}
            </View>
          )}
        </>
      )}

      <Row gap={8} style={{ marginTop: 12 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textMuted}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleSubmit}
          style={{
            flex: 1,
            height: 38,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 14,
            fontSize: 14,
            color: colors.text,
            backgroundColor: colors.background,
          }}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={!draft.trim() || submitting}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          style={{
            width: 38,
            height: 38,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !draft.trim() || submitting ? 0.4 : 1,
          }}
        >
          {submitting ? <Spinner size="small" /> : <Send size={18} color={colors.primary} />}
        </Pressable>
      </Row>
    </View>
  );
}
