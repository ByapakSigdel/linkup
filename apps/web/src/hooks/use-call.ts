'use client';

import { useCallback } from 'react';
import { getSocket } from '@/lib/socket';
import { useCallStore, type CallType } from '@/stores/call-store';
import api from '@/lib/api';

interface CallPeer {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
}

export function useCall() {
  const startCall = useCallback(async (type: CallType, peer: CallPeer) => {
    const socket = getSocket();
    if (!socket?.connected) return;
    useCallStore.getState().setCalling(type, peer);
    socket.emit('call:initiate', { callType: type });
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
