'use client';

// Opt-in profile creation for a couple's Circle (Instagram-for-couples).
// Collects: @handle (lowercase a-z0-9_, 3-30), display name (prefilled from the
// couple), bio, avatar + cover image (uploaded via /media/upload), and a
// public/private toggle. Calls POST /circles (createCircle) then fires onCreated
// with the new circle so the parent page can swap its opt-in CTA for the feed.

import { useRef, useState } from 'react';
import { Camera, Globe, ImagePlus, Lock, X } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useToastStore } from '@/stores/toast-store';
import { useAuthStore } from '@/stores/auth-store';
import * as circlesApi from '@/lib/circles-api';
import type { CircleProfileResponse } from './types';

interface CreateCircleFormProps {
  /** Called with the freshly created circle on success. */
  onCreated: (circle: CircleProfileResponse['circle']) => void;
  /** Optional dismiss affordance (renders a close button + Cancel). */
  onCancel?: () => void;
}

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

function sanitizeHandle(raw: string): string {
  // Live-normalize toward the server rule: lowercase, only a-z0-9_, max 30.
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);
}

export function CreateCircleForm({ onCreated, onCancel }: CreateCircleFormProps) {
  const couple = useAuthStore((s) => s.couple);
  const pushToast = useToastStore((s) => s.push);

  const [handle, setHandle] = useState('');
  const [name, setName] = useState(couple?.coupleName ?? '');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // Local preview + uploaded cdnUrl for avatar/cover.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    couple?.coupleAvatarUrl ?? null,
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleValid = HANDLE_RE.test(handle);
  const handleTooShort = handle.length > 0 && handle.length < 3;

  async function uploadImage(
    file: File,
    setUrl: (url: string) => void,
    setBusy: (busy: boolean) => void,
  ) {
    if (!couple?.id) {
      setError('You must be part of a couple to create a circle.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { media } = await circlesApi.uploadMedia(file, couple.id);
      setUrl(media.cdnUrl);
    } catch {
      setError('Image upload failed. Please try another file.');
    } finally {
      setBusy(false);
    }
  }

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (file) void uploadImage(file, setAvatarUrl, setUploadingAvatar);
  }

  function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void uploadImage(file, setCoverUrl, setUploadingCover);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!handleValid) {
      setError('Pick a handle: 3-30 lowercase letters, numbers or underscores.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { circle } = await circlesApi.createCircle({
        handle,
        name: name.trim() || undefined,
        bio: bio.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
        coverImageUrl: coverUrl ?? undefined,
        isPrivate,
      });
      pushToast({
        title: 'Your circle is live',
        body: `@${circle.handle} is ready to share.`,
        variant: 'success',
      });
      onCreated(circle);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ||
        'Could not create your circle. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-lk="card"
      data-variant="elevated"
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {/* Cover band with overlapping avatar */}
      <div className="relative">
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={uploadingCover}
          aria-label="Upload cover image"
          className={cn(
            'group relative flex h-32 w-full items-center justify-center overflow-hidden',
            'bg-gradient-to-br from-primary/20 via-surface-hover to-secondary/20',
            'transition-colors hover:from-primary/30 hover:to-secondary/30',
          )}
        >
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span className="relative z-10 flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-text backdrop-blur-sm">
            <ImagePlus className="h-3.5 w-3.5" />
            {uploadingCover ? 'Uploading…' : coverUrl ? 'Change cover' : 'Add cover'}
          </span>
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 rounded-full bg-background/70 p-1.5 text-text backdrop-blur-sm transition-colors hover:bg-background"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Avatar uploader, overlapping the cover */}
        <div className="absolute -bottom-10 left-5 z-10">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={uploadingAvatar}
            aria-label="Upload avatar"
            className="group relative block h-20 w-20 overflow-hidden rounded-full border-4 border-surface bg-primary-light shadow-md"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-primary">
                <Camera className="h-6 w-6" />
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-text" />
            </span>
          </button>
        </div>
      </div>

      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onPickAvatar}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={onPickCover}
      />

      <form onSubmit={handleSubmit} className="space-y-4 px-5 pb-5 pt-12">
        <div>
          <h3 className="font-display text-lg font-semibold text-text">
            Create your circle
          </h3>
          <p className="text-sm text-text-muted">
            One shared profile for the two of you.
          </p>
        </div>

        {/* Handle */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="circle-handle" className="text-sm font-medium text-text">
            Handle
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-text-muted">
              @
            </span>
            <Input
              id="circle-handle"
              value={handle}
              onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
              placeholder="usandyou"
              className="pl-7"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={30}
              autoFocus
              error={handleTooShort ? 'At least 3 characters' : undefined}
            />
          </div>
          {!handleTooShort && (
            <p className="text-xs text-text-muted">
              Lowercase letters, numbers and underscores. This is your public
              @handle.
            </p>
          )}
        </div>

        {/* Display name */}
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sam & Alex"
          maxLength={60}
        />

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="circle-bio" className="text-sm font-medium text-text">
            Bio{' '}
            <span className="font-normal text-text-muted">(optional)</span>
          </label>
          <textarea
            id="circle-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A little about the two of you…"
            rows={3}
            maxLength={280}
            className="w-full resize-none rounded-[var(--lk-input-radius)] border border-border bg-transparent px-3.5 py-2 text-sm text-text placeholder:text-text-muted transition-all focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
          />
        </div>

        {/* Privacy */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text">Privacy</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              aria-pressed={!isPrivate}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                !isPrivate
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-transparent text-text-muted hover:bg-surface-hover',
              )}
            >
              <Globe className="h-4 w-4" />
              <span className="font-medium">Public</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              aria-pressed={isPrivate}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                isPrivate
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-border bg-transparent text-text-muted hover:bg-surface-hover',
              )}
            >
              <Lock className="h-4 w-4" />
              <span className="font-medium">Private</span>
            </button>
          </div>
          <p className="text-xs text-text-muted">
            {isPrivate
              ? 'People send a request before they can follow and see your posts.'
              : 'Anyone can follow and see your posts.'}
          </p>
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            loading={submitting}
            disabled={!handleValid || uploadingAvatar || uploadingCover}
          >
            Create circle
          </Button>
        </div>
      </form>
    </div>
  );
}
