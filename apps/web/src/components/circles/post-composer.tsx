'use client';

// PostComposer — photo-first composer for the owner's circle. The user picks one
// or more images, they're uploaded to /media/upload (field `file`, body
// `coupleId`), and the resulting cdnUrls are sent to createPost together with an
// optional caption. No poll/event/announcement types: this is purely photos.

import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X, Images } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Card, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import * as circlesApi from '@/lib/circles-api';
import type { CirclePost } from '@/components/circles/types';

interface PendingImage {
  /** Stable key for React lists. */
  key: string;
  file: File;
  /** Local object URL for the thumbnail preview. */
  previewUrl: string;
}

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif';
const MAX_IMAGES = 10;

export interface PostComposerProps {
  /** Called with the freshly-created post so the parent can prepend it. */
  onPosted?: (post: CirclePost) => void;
  /** Optional cancel affordance (e.g. close a sheet/modal). */
  onCancel?: () => void;
  className?: string;
}

export function PostComposer({ onPosted, onCancel, className }: PostComposerProps) {
  const coupleId = useAuthStore((s) => s.couple?.id ?? null);

  const [images, setImages] = useState<PendingImage[]>([]);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) return;
    setError(null);
    setImages((prev) => {
      const room = MAX_IMAGES - prev.length;
      const accepted = incoming.slice(0, Math.max(0, room));
      const mapped: PendingImage[] = accepted.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      if (incoming.length > room) {
        setError(`You can attach up to ${MAX_IMAGES} photos per post.`);
      }
      return [...prev, ...mapped];
    });
  }, []);

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) addFiles(e.target.files);
      e.target.value = ''; // allow re-selecting the same file
    },
    [addFiles],
  );

  const removeImage = useCallback((key: string) => {
    setImages((prev) => {
      const removed = prev.find((p) => p.key === key);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((p) => p.key !== key);
    });
  }, []);

  const reset = useCallback(() => {
    setImages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
    setCaption('');
    setError(null);
  }, []);

  const canSubmit = images.length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (images.length === 0) {
      setError('Add at least one photo to share.');
      return;
    }
    if (!coupleId) {
      setError('We could not find your couple. Please reload and try again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1) Upload each image, then 2) create the post with the returned cdnUrls.
      const uploaded = await Promise.all(
        images.map((img) => circlesApi.uploadMedia(img.file, coupleId)),
      );
      const mediaUrls = uploaded.map((u) => u.media.cdnUrl);
      const { post } = await circlesApi.createPost({
        mediaUrls,
        caption: caption.trim() || undefined,
        type: mediaUrls.length > 1 ? 'carousel' : 'photo',
      });
      onPosted?.(post);
      reset();
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
          ?.response?.data?.error?.message ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong while sharing your post.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [images, coupleId, caption, onPosted, reset]);

  return (
    <Card cardStyle="bordered" padding="md" className={cn('space-y-4', className)}>
      {/* Picker / previews */}
      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 transition-all',
            'hover:border-primary/60 hover:bg-surface-hover',
          )}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-active text-text-muted transition-colors group-hover:bg-primary group-hover:text-text-on-primary">
            <ImagePlus className="h-7 w-7" />
          </span>
          <span className="text-center">
            <span className="block text-sm font-medium text-text">
              Share a photo
            </span>
            <span className="mt-1 block text-xs text-text-muted">
              Pick one or more photos for your circle
            </span>
          </span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.key}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt="Selected photo preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(img.key)}
                disabled={submitting}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/70 text-text backdrop-blur-sm transition-opacity hover:bg-background disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              aria-label="Add more photos"
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-text-muted transition-colors hover:border-primary/60 hover:bg-surface-hover disabled:opacity-50"
            >
              <Images className="h-5 w-5" />
              <span className="text-[10px] font-medium">Add</span>
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        onChange={handleSelect}
        className="hidden"
      />

      {/* Caption */}
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write a caption… (optional)"
        rows={3}
        maxLength={2200}
        disabled={submitting}
        className={cn(
          'w-full resize-none rounded-[var(--lk-input-radius)] border border-border bg-transparent px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted transition-all',
          'focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20',
          'disabled:opacity-50',
        )}
      />

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-muted">
          {images.length > 0
            ? `${images.length} photo${images.length === 1 ? '' : 's'} selected`
            : 'Photos only'}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
          >
            {submitting ? 'Sharing…' : 'Share'}
          </Button>
        </div>
      </div>

      {submitting && images.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Spinner size="sm" />
          Uploading {images.length} photo{images.length === 1 ? '' : 's'}…
        </div>
      )}
    </Card>
  );
}
