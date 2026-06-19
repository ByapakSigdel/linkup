'use client';

import { useCallback, useEffect, useState } from 'react';
import { Smile } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useCustomEmojiStore } from '@/stores/custom-emoji-store';
import { Spinner } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import {
  EmojiCreator,
  EmojiCard,
  type CustomEmoji,
  type NewEmojiPayload,
} from '@/components/emojis';

export default function EmojisPage() {
  const couple = useAuthStore((s) => s.couple);
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEmojis = useCallback(async () => {
    try {
      const { data } = await api.get('/creative/emojis');
      setEmojis(data.data.emojis ?? []);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? 'Could not load your emojis.';
      useToastStore.getState().push({ title: 'Something went wrong', body: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) {
      void loadEmojis();
    } else {
      setLoading(false);
    }
  }, [couple?.isPaired, loadEmojis]);

  const handleCreate = useCallback(async (payload: NewEmojiPayload) => {
    try {
      const { data } = await api.post('/creative/emojis', payload);
      const created: CustomEmoji = data.data.emoji;
      setEmojis((prev) => [created, ...prev]);
      // Make it usable in chat immediately (bubbles render :name: from this store).
      useCustomEmojiStore.getState().add({
        id: created.id,
        name: created.name,
        imageUrl: created.imageUrl,
        isAnimated: created.isAnimated,
      });
      useToastStore.getState().push({
        title: 'Emoji created',
        body: `:${created.name}: is ready to use`,
        icon: '✨',
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? 'Could not create that emoji.';
      useToastStore.getState().push({ title: 'Create failed', body: message });
      throw err;
    }
  }, []);

  const handleCopy = useCallback(async (emoji: CustomEmoji) => {
    const code = `:${emoji.name}:`;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard may be unavailable; still record usage and notify.
    }
    useToastStore.getState().push({
      title: 'Copied to clipboard',
      body: `${code} is ready to paste`,
      icon: '📋',
    });
    // Optimistically bump local use count.
    setEmojis((prev) =>
      prev.map((e) =>
        e.id === emoji.id ? { ...e, useCount: e.useCount + 1 } : e,
      ),
    );
    try {
      const { data } = await api.post(`/creative/emojis/${emoji.id}/use`);
      const updated: CustomEmoji | undefined = data.data?.emoji;
      if (updated) {
        setEmojis((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e)),
        );
      }
    } catch {
      // Non-fatal: keep optimistic count.
    }
  }, []);

  const handleDelete = useCallback(async (emoji: CustomEmoji) => {
    setDeletingId(emoji.id);
    try {
      await api.delete(`/creative/emojis/${emoji.id}`);
      setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      useToastStore.getState().push({
        title: 'Emoji deleted',
        body: `:${emoji.name}: was removed`,
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          .response?.data?.error?.message ?? 'Could not delete that emoji.';
      useToastStore.getState().push({ title: 'Delete failed', body: message });
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ---- Not paired ----
  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-active">
          <LinkupMark size={30} />
        </div>
        <h2 className="text-lg font-semibold text-text">Custom emojis</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to build your own private collection of
          emojis you can use in chat.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Custom Emojis</h1>
        <p className="text-sm text-text-muted">
          Upload or draw your own emojis, then drop them into chat with{' '}
          <span className="font-mono text-text">:name:</span>
        </p>
      </div>

      <EmojiCreator onCreate={handleCreate} />

      {/* Library */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">
            Your library
            {!loading && emojis.length > 0 && (
              <span className="ml-2 font-mono text-text-muted">({emojis.length})</span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" className="text-primary" />
          </div>
        ) : emojis.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-active">
              <Smile className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text">No emojis yet</p>
            <p className="mt-1 max-w-xs text-xs text-text-muted">
              Create your first one above — upload an image or draw something
              together.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {emojis.map((emoji) => (
              <EmojiCard
                key={emoji.id}
                emoji={emoji}
                onCopy={handleCopy}
                onDelete={handleDelete}
                deleting={deletingId === emoji.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
