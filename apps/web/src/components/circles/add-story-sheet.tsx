'use client';

// AddStorySheet — a bottom sheet / modal for adding a 24h story to MY circle.
// Flow: pick an image -> preview -> (optional caption) -> upload via
// /media/upload (uploadMedia) -> POST /circles/me/stories (addStory). On
// success, calls onAdded(story) so the parent can refresh the story tray.

import { useEffect, useRef, useState } from 'react';
import { X, ImagePlus, Send } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { Emoji } from '@/components/ui/emoji';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import type { Story } from './types';

interface AddStorySheetProps {
  /** Controls visibility. */
  open: boolean;
  /** Close the sheet (backdrop, X, Escape, or after a successful add). */
  onClose: () => void;
  /** Fired with the freshly created story so the parent can refresh its tray. */
  onAdded?: (story: Story) => void;
}

const MAX_BYTES = 25 * 1024 * 1024; // 25MB guardrail

export function AddStorySheet({ open, onClose, onAdded }: AddStorySheetProps) {
  const couple = useAuthStore((s) => s.couple);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset all local state whenever the sheet is (re)opened or closed.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setCaption('');
      setSubmitting(false);
    }
  }, [open]);

  // Manage the object-URL lifecycle for the chosen image preview.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Allow re-picking the same file later.
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      useToastStore.getState().push({
        title: 'Unsupported file',
        body: 'Please choose an image for your story.',
      });
      return;
    }
    if (f.size > MAX_BYTES) {
      useToastStore.getState().push({
        title: 'Image too large',
        body: 'Please choose an image under 25MB.',
      });
      return;
    }
    setFile(f);
  };

  const handleShare = async () => {
    if (!file || submitting) return;
    if (!couple?.id) {
      useToastStore.getState().push({
        title: 'No couple linked',
        body: 'You need a linked couple to post a story.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const { media } = await circlesApi.uploadMedia(file, couple.id);
      const { story } = await circlesApi.addStory({
        mediaUrl: media.cdnUrl,
        mediaType: 'image',
        caption: caption.trim() || undefined,
      });
      useToastStore.getState().push({
        title: 'Story added',
        body: 'Your story is live for the next 24 hours.',
        variant: 'success',
      });
      onAdded?.(story);
      onClose();
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      useToastStore.getState().push({
        title: 'Could not add story',
        body:
          e.response?.data?.error?.message ||
          'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add a story"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={() => !submitting && onClose()}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />

      {/* Sheet */}
      <div
        className={cn(
          'relative z-10 flex w-full max-w-md flex-col overflow-hidden border border-border bg-surface shadow-xl',
          'rounded-t-2xl sm:rounded-2xl',
          'max-h-[90vh]',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-display text-base font-semibold text-text">
            Add to your story
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={pickFile}
            className="hidden"
          />

          {previewUrl ? (
            <div className="space-y-4">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-xl border border-border bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Story preview"
                  className="h-full w-full object-cover"
                />
                {caption.trim() && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="break-words text-center text-sm font-medium text-white drop-shadow">
                      {caption.trim()}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => !submitting && setFile(null)}
                  disabled={submitting}
                  className="absolute right-2 top-2 rounded-full bg-background/70 p-1 text-text backdrop-blur transition-colors hover:bg-background disabled:opacity-50"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label
                  htmlFor="story-caption"
                  className="mb-1.5 block text-xs font-medium text-text-muted"
                >
                  Caption (optional)
                </label>
                <textarea
                  id="story-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Say something..."
                  rows={2}
                  maxLength={300}
                  disabled={submitting}
                  className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-muted transition-all focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20 disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover disabled:opacity-50"
              >
                Choose a different photo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-[9/16] w-full max-w-[260px] mx-auto flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background/40 text-text-muted transition-colors hover:border-border-focus hover:bg-surface-hover hover:text-text"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
                <ImagePlus className="h-7 w-7" />
              </span>
              <span className="text-sm font-medium">Choose a photo</span>
              <span className="px-6 text-center text-xs text-text-muted">
                Shared with your followers for 24 hours <Emoji emoji="✨" size={14} />
              </span>
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <Button
            type="button"
            className="w-full"
            onClick={handleShare}
            loading={submitting}
            disabled={!file || submitting}
          >
            {submitting ? (
              <>
                <Spinner size="sm" />
                Sharing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Share to story
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
