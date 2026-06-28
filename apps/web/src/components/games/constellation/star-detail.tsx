'use client';

import { useRef, useState } from 'react';
import { Button, Card, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';
import { useMediaStore } from '@/stores/media-store';
import { useToastStore } from '@/stores/toast-store';
import type { Star } from './types';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function usePartnerName(): string {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  if (!couple || !user) return 'Partner';
  // couple object has partner1Id + partner2Id but not display names;
  // fall back gracefully.
  void couple;
  return 'Partner';
}

/* ─── Answer display for shared / custom kind ──────────────────────────────── */

function SharedAnswers({
  star,
  userId,
  partnerName,
  readOnly,
}: {
  star: Star;
  userId: string;
  partnerName: string;
  readOnly?: boolean;
}) {
  const patchStar = useConstellationStore((s) => s.patchStar);
  const toast = useToastStore.getState();

  // answers is Record<userId, { text: string }>
  const answers = star.answers as Record<string, { text?: string }>;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  async function saveEdit() {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await patchStar(star.id, { text: editText.trim() });
      setEditingId(null);
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setSaving(false);
    }
  }

  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return <p className="text-sm text-text-muted">No answers yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([uid, val]) => {
        const isMe = uid === userId;
        const label = isMe ? 'You' : partnerName;
        const text = val?.text ?? '';
        const isEditing = editingId === uid;

        return (
          <div
            key={uid}
            className={cn(
              'flex flex-col gap-1 rounded-xl border p-3',
              isMe ? 'border-primary bg-primary-light' : 'border-border bg-surface-hover',
            )}
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className={cn('text-sm font-medium', isMe ? 'text-primary' : 'text-text-muted')}>
                {label}
              </span>
              {isMe && !isEditing && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setEditText(text);
                    setEditingId(uid);
                  }}
                  className="text-xs text-text-muted transition-colors hover:text-text"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  autoFocus
                  className="min-h-18 w-full resize-none rounded-[var(--lk-input-radius)] border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-border-focus/20"
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void saveEdit()}
                    loading={saving}
                    disabled={!editText.trim()}
                  >
                    Save
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text">{text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Answer display for guess kind ─────────────────────────────────────────── */

function GuessAnswers({
  star,
  userId,
  partnerName,
  readOnly,
}: {
  star: Star;
  userId: string;
  partnerName: string;
  readOnly?: boolean;
}) {
  const patchStar = useConstellationStore((s) => s.patchStar);
  const toast = useToastStore.getState();

  // answers shape for guess: { answer?: { text, by }, guess?: { text, by }, subjectId?: string, matched?: boolean | null }
  const ans = star.answers as {
    answer?: { text?: string; by?: string };
    guess?: { text?: string; by?: string };
    subjectId?: string;
    matched?: boolean | null;
  };

  const [judging, setJudging] = useState(false);

  async function judge(matched: boolean) {
    setJudging(true);
    try {
      await patchStar(star.id, { matched });
    } catch {
      toast.push({ title: 'Could not save', body: 'Please try again.', variant: 'info' });
    } finally {
      setJudging(false);
    }
  }

  const iAmSubject = ans.subjectId === userId;

  return (
    <div className="flex flex-col gap-3">
      {/* The answer (subject's response) */}
      {ans.answer && (
        <div
          className={cn(
            'flex flex-col gap-1 rounded-xl border p-3',
            iAmSubject ? 'border-primary bg-primary-light' : 'border-border bg-surface-hover',
          )}
        >
          <span className={cn('text-sm font-medium', iAmSubject ? 'text-primary' : 'text-text-muted')}>
            {iAmSubject ? 'Your answer' : `${partnerName}'s answer`}
          </span>
          <p className="text-sm text-text">{ans.answer.text ?? ''}</p>
        </div>
      )}

      {/* The guess — labelled by who actually wrote it (guess.by). */}
      {ans.guess &&
        (() => {
          const guessIsMine = ans.guess?.by === userId;
          return (
            <div
              className={cn(
                'flex flex-col gap-1 rounded-xl border p-3',
                guessIsMine ? 'border-primary bg-primary-light' : 'border-border bg-surface-hover',
              )}
            >
              <span
                className={cn('text-sm font-medium', guessIsMine ? 'text-primary' : 'text-text-muted')}
              >
                {guessIsMine ? 'Your guess' : `${partnerName}'s guess`}
              </span>
              <p className="text-sm text-text">{ans.guess.text ?? ''}</p>
            </div>
          );
        })()}

      {/* Self-judge: show only if I am the subject AND a guess exists AND not
          yet judged AND we're not in read-only memorial mode. */}
      {iAmSubject && ans.guess && ans.matched == null && !readOnly && (
        <Card cardStyle="bordered">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">Did they nail it?</span>
            {judging ? (
              <Spinner size="sm" />
            ) : (
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => void judge(true)}>
                  Nailed it ✓
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void judge(false)}>
                  So close
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Matched indicator if already judged */}
      {ans.matched != null && (
        <p className="text-xs italic text-text-muted">
          {ans.matched ? '✓ matched' : 'missed'}
        </p>
      )}
    </div>
  );
}

/* ─── Photo section ──────────────────────────────────────────────────────── */

function PhotoSection({ star, readOnly }: { star: Star; readOnly?: boolean }) {
  const couple = useAuthStore((s) => s.couple);
  const uploadFile = useMediaStore((s) => s.uploadFile);
  const patchStar = useConstellationStore((s) => s.patchStar);
  const toast = useToastStore.getState();

  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read-only memorial: show the photo if one exists, but never the add/change
  // affordance. A starless star simply renders nothing here.
  if (readOnly) {
    if (!star.photoUrl) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={star.photoUrl}
        alt={star.title}
        className="h-56 w-full rounded-xl bg-surface-hover object-cover"
      />
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !couple?.id) return;
    setBusy(true);
    try {
      const media = await uploadFile(couple.id, file);
      if (media?.cdnUrl) await patchStar(star.id, { photoUrl: media.cdnUrl });
    } catch {
      toast.push({ title: 'Upload failed', body: 'Please try again.', variant: 'info' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {star.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={star.photoUrl}
          alt={star.title}
          className="h-56 w-full rounded-xl bg-surface-hover object-cover"
        />
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        size="sm"
        loading={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : star.photoUrl ? 'Change photo' : 'Add a photo'}
      </Button>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function StarDetail({
  star,
  onClose,
  readOnly,
}: {
  star: Star;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const userId = useAuthStore((s) => s.user?.id ?? '');
  const partnerName = usePartnerName();
  const live = useConstellationStore((s) => s.stars.find((x) => x.id === star.id)) ?? star;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />

      {/* Panel */}
      <div
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-2xl border border-b-0 border-border bg-surface shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 pb-1">
          <p className="flex-1 text-base font-semibold text-text">{live.title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-2xl leading-7 text-text-muted transition-colors hover:text-text"
          >
            ×
          </button>
        </div>

        {/* Kind chip */}
        <div className="px-4 pb-2">
          <span className="text-xs capitalize text-text-muted">
            {live.kind === 'guess'
              ? 'Guess the answer'
              : live.kind === 'custom'
                ? 'Your story'
                : 'Shared memory'}
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-10 pt-2">
          {/* Answers section */}
          {live.kind === 'guess' ? (
            <GuessAnswers star={live} userId={userId} partnerName={partnerName} readOnly={readOnly} />
          ) : (
            <SharedAnswers star={live} userId={userId} partnerName={partnerName} readOnly={readOnly} />
          )}

          {/* Photo section */}
          <PhotoSection star={live} readOnly={readOnly} />
        </div>
      </div>
    </div>
  );
}
