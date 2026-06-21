// FollowButton — the Instagram-style follow control for a circle, ported from
// apps/web/src/components/circles/follow-button.tsx.
//
//   none      → "Follow"/"Request" → follow() → public:'accepted', private:'pending'
//   pending   → "Requested"        → unfollow() (cancels the request)
//   accepted  → "Following"        → unfollow()
//
// Optimistic updates + realtime sync over the shared socket. If the viewer has no
// circle of their own, following is impossible, so we surface a gentle toast.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, UserPlus, Clock } from 'lucide-react-native';
import { Pressable, View, ActivityIndicator, Text } from 'react-native';
import { useTheme } from '@/theme';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import * as circlesApi from '@/lib/circles-api';
import type { FollowState } from './types';

export interface FollowButtonProps {
  idOrHandle: string;
  followState: FollowState;
  isPrivate?: boolean;
  isOwner?: boolean;
  onStateChange?: (state: FollowState) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function FollowButton({
  idOrHandle,
  followState,
  isPrivate = false,
  isOwner = false,
  onStateChange,
  size = 'sm',
  fullWidth = false,
}: FollowButtonProps) {
  const { colors, radius } = useTheme();
  const [state, setState] = useState<FollowState>(followState);
  const [pending, setPending] = useState(false);
  const [hasCircle, setHasCircle] = useState<boolean | null>(null);
  const checkedRef = useRef(false);

  // Keep in sync if the parent re-derives followState (e.g. after a fetch).
  useEffect(() => {
    setState(followState);
  }, [followState]);

  // Realtime: reflect accept/remove toward this circle elsewhere.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAccepted = (payload: {
      circle?: { id?: string; handle?: string | null };
    }) => {
      const c = payload?.circle;
      if (!c) return;
      if (c.id === idOrHandle || (c.handle && c.handle === idOrHandle))
        setState('accepted');
    };
    const onRemoved = (payload: {
      circle?: { id?: string; handle?: string | null };
    }) => {
      const c = payload?.circle;
      if (!c) return;
      if (c.id === idOrHandle || (c.handle && c.handle === idOrHandle))
        setState('none');
    };
    socket.on('follow:accepted', onAccepted);
    socket.on('follow:removed', onRemoved);
    return () => {
      socket.off('follow:accepted', onAccepted);
      socket.off('follow:removed', onRemoved);
    };
  }, [idOrHandle]);

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
      setHasCircle(true);
      return true;
    }
  }, [hasCircle]);

  const handlePress = useCallback(async () => {
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
        });
      } finally {
        setPending(false);
      }
    } else {
      setState('none');
      try {
        await circlesApi.unfollow(idOrHandle);
        onStateChange?.('none');
      } catch {
        setState(prev);
        useToastStore.getState().push({
          title:
            prev === 'pending'
              ? 'Could not cancel request'
              : 'Could not unfollow',
          body: 'Please try again.',
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

  const label = isFollowing
    ? 'Following'
    : isPendingState
      ? 'Requested'
      : isPrivate
        ? 'Request'
        : 'Follow';

  const Icon = isFollowing ? Check : isPendingState ? Clock : UserPlus;

  const heights: Record<'sm' | 'md' | 'lg', number> = { sm: 36, md: 44, lg: 50 };
  const bg = isNone ? colors.primary : 'transparent';
  const fg = isNone ? colors.textOnPrimary : colors.text;
  const borderColor = isNone ? 'transparent' : colors.border;

  return (
    <Pressable
      onPress={handlePress}
      disabled={pending}
      accessibilityRole="button"
      accessibilityState={{ selected: !isNone }}
      style={({ pressed }) => [
        {
          height: heights[size],
          minWidth: 104,
          borderRadius: 999,
          backgroundColor: bg,
          borderWidth: isNone ? 0 : 1,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 16,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: pending ? 0.7 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {pending ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          <Icon size={14} color={fg} />
          <Text style={{ color: fg, fontSize: 13, fontWeight: '700' }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
