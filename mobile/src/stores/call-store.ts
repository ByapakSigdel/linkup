import { create } from 'zustand';

export type CallType = 'voice' | 'video' | 'screen';
export type CallPhase = 'idle' | 'calling' | 'incoming' | 'connecting' | 'in-call';

interface CallPeer {
  id?: string;
  displayName?: string;
  avatarUrl?: string;
}

interface CallState {
  phase: CallPhase;
  callType: CallType;
  isCaller: boolean;
  peer: CallPeer | null;
  muted: boolean;
  cameraOff: boolean;
  startedAt: number | null;
  callRecordId: string | null;
  /** When true the full-screen call UI collapses to a floating bubble so the
   *  couple can use the rest of the app (games, watch, draw) mid-call. */
  minimized: boolean;

  setIncoming: (callType: CallType, peer: CallPeer) => void;
  setCalling: (callType: CallType, peer: CallPeer) => void;
  setConnecting: () => void;
  setInCall: () => void;
  setMuted: (m: boolean) => void;
  setCameraOff: (c: boolean) => void;
  setCallRecordId: (id: string | null) => void;
  setMinimized: (m: boolean) => void;
  reset: () => void;
}

export const useCallStore = create<CallState>()((set) => ({
  phase: 'idle',
  callType: 'voice',
  isCaller: false,
  peer: null,
  muted: false,
  cameraOff: false,
  startedAt: null,
  callRecordId: null,
  minimized: false,

  setIncoming: (callType, peer) =>
    set({ phase: 'incoming', callType, peer, isCaller: false, minimized: false }),
  setCalling: (callType, peer) =>
    set({ phase: 'calling', callType, peer, isCaller: true, minimized: false }),
  setConnecting: () => set({ phase: 'connecting' }),
  setInCall: () => set({ phase: 'in-call', startedAt: Date.now() }),
  setMuted: (m) => set({ muted: m }),
  setCameraOff: (c) => set({ cameraOff: c }),
  setCallRecordId: (id) => set({ callRecordId: id }),
  setMinimized: (m) => set({ minimized: m }),
  reset: () =>
    set({
      phase: 'idle',
      isCaller: false,
      peer: null,
      muted: false,
      cameraOff: false,
      startedAt: null,
      callRecordId: null,
      minimized: false,
    }),
}));
