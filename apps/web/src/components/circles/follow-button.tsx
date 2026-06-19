'use client';

// FollowButton — the Instagram-style follow control for a circle.
// Derives its label from `followState` ('none' | 'pending' | 'accepted') and
// applies optimistic updates while calling follow()/unfollow().
//
//   none      → "Follow"     (primary)   → follow() → public:'accepted', private:'pending'
//   pending   → "Requested"  (outline)   → unfollow() (cancels the request)
//   accepted  → "Following"  (outline)   → unfollow()
//
// If the viewer has no circle of their own, following is impossible (the backend
// requires an opt-in circle to follow from), so we surface a gentle hint instead.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, UserPlus, Clock } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import type { FollowState } from './types';

export interface FollowButtonProps {
  /** Circle id or @handle to follow/unfollow. */
  idOrHandle: string;
  /** Current viewer-relative follow state. */
  followState: FollowState;
  /** Whether the target circle is private (drives the "Requested" wording). */
  isPrivate?: boolean;
  /** Hide the button entirely (e.g. when viewing your own circle). */
  isOwner?: boolean;
  /** Fired after a successful follow/unfollow so parents can sync counts/lists. */
  onStateChange?: (state: FollowState) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Stretch to fill the available width. */
  fullWidth?: boolean;
}

export function FollowButton({
  idOrHandle,
  followState,
  isPrivate = false,
  isOwner = false,
  onStateChange,
  size = 'sm',
  className,
  fullWidth = false,
}: FollowButtonProps) {
  const couple = useAuthStore((s) => s.couple);
  const [state, setState] = useState<FollowState>(followState);
  const [pending, setPending] = useState(false);
  const [hovering, setHovering] = useState(false);
  // null = unknown (not yet checked); true/false once we know.
  const [hasCircle, setHasCircle] = useState<boolean | null>(null);
  const checkedRef = useRef(false);

  // Keep in sync if the parent re-derives followState (e.g. after a fetch).
  useEffect(() => {
    setState(followState);
  }, [followState]);

  // Realtime: if the viewer's own follow toward this circle changes elsewhere
  // (request accepted, removed by the other side), reflect it here.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAccepted = (payload: { circle?: { id?: string; handle?: string | null } }) => {
      const c = payload?.circle;
      if (!c) return;
      if (c.id === idOrHandle || (c.handle && c.handle === idOrHandle)) {
        setState('accepted');
      }
    };
    const onRemoved = (payload: { circle?: { id?: string; handle?: string | null } }) => {
      const c = payload?.circle;
      if (!c) return;
      if (c.id === idOrHandle || (c.handle && c.handle === idOrHandle)) {
        setState('none');
      }
    };

    socket.on('follow:accepted', onAccepted);
    socket.on('follow:removed', onRemoved);
    return () => {
      socket.off('follow:accepted', onAccepted);
      socket.off('follow:removed', onRemoved);
    };
  }, [idOrHandle]);

  // Lazily confirm whether the viewer owns a circle (needed to follow from).
  // We only check once, on first interaction, to keep list rows cheap.
  const ensureHasCircle = useCallback(async (): Promise<boolean> => {
    if (hasCircle !== null) return hasCircle;
    if (checkedRef.current) return false;
    checkedRef.current = true;
    try {
      const me = await circlesApi.getMyCircle();
      const owns = !!me.circle;
      setHasCircle(owns);
      return owns;
    } catch {
      // If we can't tell, let the request proceed; the API is the source of truth.
      setHasCircle(true);
      return true;
    }
  }, [hasCircle]);

  const handleClick = useCallback(async () => {
    if (pending || isOwner) return;

    const owns = await ensureHasCircle();
    if (!owns) {
      useToastStore.getState().push({
        title: 'Create your circle first',
        body: 'You need your own couple circle before you can follow others.',
        variant: 'info',
      });
      return;
    }

    const prev = state;
    setPending(true);

    if (prev === 'none') {
      // Optimistic: public follows resolve to accepted, private to pending.
      const optimistic: FollowState = isPrivate ? 'pending' : 'accepted';
      setState(optimistic);
      try {
        const { follow } = await circlesApi.follow(idOrHandle);
        const next = follow?.status ?? optimistic;
        setState(next);
        onStateChange?.(next);
      } catch {
        setState(prev);
        useToastStore.getState().push({
          title: 'Could not follow',
          body: 'Please try again.',
          variant: 'default',
        });
      } finally {
        setPending(false);
      }
    } else {
      // pending → cancel request, accepted → unfollow. Both call unfollow().
      setState('none');
      try {
        await circlesApi.unfollow(idOrHandle);
        onStateChange?.('none');
      } catch {
        setState(prev);
        useToastStore.getState().push({
          title: prev === 'pending' ? 'Could not cancel request' : 'Could not unfollow',
          body: 'Please try again.',
          variant: 'default',
        });
      } finally {
        setPending(false);
      }
    }
  }, [pending, isOwner, ensureHasCircle, state, isPrivate, idOrHandle, onStateChange]);

  if (isOwner) return null;

  const isFollowing = state === 'accepted';
  const isPendingState = state === 'pending';
  const isNone = state === 'none';

  // Following / Requested use the subtle outline; hovering reveals the un-action.
  const label = isFollowing
    ? hovering
      ? 'Unfollow'
      : 'Following'
    : isPendingState
      ? hovering
        ? 'Cancel'
        : 'Requested'
      : isPrivate
        ? 'Request'
        : 'Follow';

  const Icon = isFollowing ? Check : isPendingState ? Clock : UserPlus;

  return (
    <Button
      type="button"
      size={size}
      shape="pill"
      variant={isNone ? 'primary' : 'outline'}
      loading={pending}
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      aria-pressed={!isNone}
      data-follow-state={state}
      className={cn(
        'min-w-[6.25rem]',
        fullWidth && 'w-full',
        // Hover on Following/Requested hints destructive intent.
        !isNone && hovering && 'border-error text-error',
        className,
      )}
      // Couple presence is informational only; the API gates the real action.
      title={!couple ? 'Pair up to create a circle and follow others' : undefined}
    >
      {!pending && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </Button>
  );
}
