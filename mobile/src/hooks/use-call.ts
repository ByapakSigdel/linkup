import { useCallback } from 'react';
import { router } from 'expo-router';
import { getSocket } from '@/lib/socket';
import { useCallStore, type CallType } from '@/stores/call-store';
import api from '@/lib/api';

interface CallPeer {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Mirrors apps/web/src/hooks/use-call.ts: marks the call store as "calling",
 * emits the `call:initiate` socket event, and records a best-effort call-history
 * row. The actual WebRTC media is owned by the calls feature; here we only wire
 * the initiation + navigate to the call screen.
 */
export function useCall() {
  const startCall = useCallback(async (type: CallType, peer: CallPeer) => {
    const socket = getSocket();
    if (!socket?.connected) return;
    useCallStore.getState().setCalling(type, peer);
    socket.emit('call:initiate', { callType: type });
    router.push('/call');
    try {
      const { data } = await api.post('/entertainment/calls', {
        type,
        status: 'ongoing',
      });
      useCallStore.getState().setCallRecordId(data?.data?.call?.id ?? null);
    } catch {
      /* call history is best-effort */
    }
  }, []);

  return { startCall };
}
