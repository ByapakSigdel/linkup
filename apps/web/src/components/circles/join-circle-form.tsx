'use client';

import { useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import api from '@/lib/api';
import { useToastStore } from '@/stores/toast-store';
import type { CircleListItem } from './types';

interface JoinCircleFormProps {
  onJoined: (circleId: string) => void;
  onCancel: () => void;
  /** Circles the couple is already in, so we can show a friendly message. */
  existingIds: string[];
}

/**
 * Joining requires both the target circle's id and (for private circles) its
 * invite code, because the API route is `POST /circles/:id/join`. There is no
 * cross-circle discovery endpoint, so we ask the user to paste an invite token
 * in the form `circleId:inviteCode` (the create flow surfaces this token for
 * sharing). Separate fields are also accepted.
 */
export function JoinCircleForm({
  onJoined,
  onCancel,
  existingIds,
}: JoinCircleFormProps) {
  const [circleId, setCircleId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allow pasting a combined "circleId:inviteCode" token into the id field.
  const handleCircleIdChange = (value: string) => {
    const trimmed = value.trim();
    // The invite code itself contains an underscore (e.g. circle_xxxx) but no
    // colon, so a colon reliably separates id from code.
    const colon = trimmed.indexOf(':');
    if (colon > 0) {
      setCircleId(trimmed.slice(0, colon));
      setInviteCode(trimmed.slice(colon + 1));
    } else {
      setCircleId(trimmed);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = circleId.trim();
    if (!id) {
      setError('Paste the invite (circle id and code).');
      return;
    }
    if (existingIds.includes(id)) {
      setError('You are already a member of this circle.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/circles/${id}/join`, {
        inviteCode: inviteCode.trim() || undefined,
      });
      useToastStore.getState().push({
        title: 'Joined circle',
        body: 'You can now share posts with the other couples.',
      });
      onJoined(id);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
          'Could not join. Check the invite and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-text">
          Join with an invite
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Invite (circle id and code)"
          placeholder="paste circleId:inviteCode"
          value={
            inviteCode && circleId ? `${circleId}:${inviteCode}` : circleId
          }
          onChange={(e) => handleCircleIdChange(e.target.value)}
          helperText="Paste the invite a member shared with you."
        />
        <Input
          label="Invite code"
          placeholder="circle_xxxxxxxxxx"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.trim())}
          helperText="Required for private circles."
        />

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            <KeyRound className="h-4 w-4" />
            Join
          </Button>
        </div>
      </form>
    </div>
  );
}
