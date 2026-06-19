'use client';

import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { useCallStore } from '@/stores/call-store';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar } from '@/components/ui';
import api from '@/lib/api';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

/**
 * Global WebRTC call controller. Renders the incoming-call prompt, the active
 * call window, and manages the peer connection + signaling over the socket.
 */
export function CallManager() {
  const phase = useCallStore((s) => s.phase);
  const callType = useCallStore((s) => s.callType);
  const peer = useCallStore((s) => s.peer);
  const isCaller = useCallStore((s) => s.isCaller);
  const muted = useCallStore((s) => s.muted);
  const cameraOff = useCallStore((s) => s.cameraOff);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Duration timer
  useEffect(() => {
    if (phase !== 'in-call') {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const cleanup = () => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingIce.current = [];
  };

  const endCall = (notify = true) => {
    if (notify) getSocket()?.emit('call:end');
    const recId = useCallStore.getState().callRecordId;
    const started = useCallStore.getState().startedAt;
    if (recId) {
      const durationSec = started ? Math.round((Date.now() - started) / 1000) : 0;
      api
        .patch(`/entertainment/calls/${recId}`, { status: 'ended', durationSec })
        .catch(() => {});
    }
    cleanup();
    useCallStore.getState().reset();
  };

  async function getMedia(type: string): Promise<MediaStream> {
    if (type === 'screen') {
      const screen = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      // also grab mic so partner can hear narration
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach((t) => screen.addTrack(t));
      } catch {
        /* mic optional */
      }
      return screen;
    }
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video',
    });
  }

  function createPeer(): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        getSocket()?.emit('call:ice', { candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      if (!stream) return;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        useCallStore.getState().setInCall();
      }
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        // leave it; user can hang up
      }
    };
    return pc;
  }

  async function attachLocal(type: string) {
    const stream = await getMedia(type);
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach((t) => pcRef.current?.addTrack(t, stream));
  }

  // Signaling listeners (live for the lifetime of the manager)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAccepted = async () => {
      // Caller side: build the offer once the callee accepts
      try {
        useCallStore.getState().setConnecting();
        pcRef.current = createPeer();
        await attachLocal(useCallStore.getState().callType);
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        socket.emit('call:offer', { sdp: offer });
      } catch {
        endCall();
      }
    };

    const onOffer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      // Callee side
      try {
        if (!pcRef.current) pcRef.current = createPeer();
        if (!localStreamRef.current) {
          await attachLocal(useCallStore.getState().callType);
        }
        await pcRef.current.setRemoteDescription(
          new RTCSessionDescription(data.sdp),
        );
        for (const c of pendingIce.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIce.current = [];
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('call:answer', { sdp: answer });
      } catch {
        endCall();
      }
    };

    const onAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      try {
        await pcRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.sdp),
        );
        for (const c of pendingIce.current) {
          await pcRef.current?.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingIce.current = [];
      } catch {
        /* ignore */
      }
    };

    const onIce = async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate),
          );
        } else {
          pendingIce.current.push(data.candidate);
        }
      } catch {
        /* ignore */
      }
    };

    const onDeclined = () => {
      cleanup();
      useCallStore.getState().reset();
    };
    const onEnded = () => endCall(false);

    socket.on('call:accepted', onAccepted);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice', onIce);
    socket.on('call:declined', onDeclined);
    socket.on('call:ended', onEnded);

    return () => {
      socket.off('call:accepted', onAccepted);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice', onIce);
      socket.off('call:declined', onDeclined);
      socket.off('call:ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function acceptIncoming() {
    useCallStore.getState().setConnecting();
    getSocket()?.emit('call:accept');
    // Record call on the callee side too (best-effort)
    try {
      const { data } = await api.post('/entertainment/calls', {
        type: useCallStore.getState().callType,
        status: 'ongoing',
      });
      useCallStore.getState().setCallRecordId(data?.data?.call?.id ?? null);
    } catch {
      /* ignore */
    }
  }

  function declineIncoming() {
    getSocket()?.emit('call:decline');
    useCallStore.getState().reset();
  }

  function toggleMute() {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    useCallStore.getState().setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    useCallStore.getState().setCameraOff(next);
  }

  if (phase === 'idle') {
    return <audio ref={remoteAudioRef} autoPlay />;
  }

  const showVideo = callType === 'video' || callType === 'screen';
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Incoming call prompt
  if (phase === 'incoming') {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-xl">
          <Avatar
            src={peer?.avatarUrl}
            name={peer?.displayName}
            size="lg"
            className="mx-auto"
          />
          <h2 className="mt-4 text-lg font-semibold text-text">
            {peer?.displayName || 'Partner'}
          </h2>
          <p className="text-sm text-text-muted">
            Incoming {callType} call…
          </p>
          <div className="mt-6 flex items-center justify-center gap-6">
            <button
              onClick={declineIncoming}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-error text-white shadow-lg transition-transform hover:scale-105"
              aria-label="Decline"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
            <button
              onClick={acceptIncoming}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white shadow-lg transition-transform hover:scale-105"
              aria-label="Accept"
            >
              <Phone className="h-6 w-6" />
            </button>
          </div>
        </div>
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    );
  }

  // Active / calling window
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-stone-900 text-white">
      {/* Remote video / avatar */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {showVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Avatar src={peer?.avatarUrl} name={peer?.displayName} size="lg" />
            <p className="text-xl font-semibold">
              {peer?.displayName || 'Partner'}
            </p>
          </div>
        )}

        {/* Local preview */}
        {showVideo && (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute bottom-4 right-4 h-32 w-24 rounded-lg border border-white/20 object-cover shadow-lg sm:h-40 sm:w-32"
          />
        )}

        {/* Status */}
        <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1.5 text-sm">
          {phase === 'calling'
            ? `Calling ${peer?.displayName || 'partner'}…`
            : phase === 'connecting'
              ? 'Connecting…'
              : fmt(elapsed)}
        </div>
        <audio ref={remoteAudioRef} autoPlay />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 bg-black/40 py-6">
        <button
          onClick={toggleMute}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>
        {callType === 'video' && (
          <button
            onClick={toggleCamera}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
            aria-label={cameraOff ? 'Camera on' : 'Camera off'}
          >
            {cameraOff ? (
              <VideoOff className="h-5 w-5" />
            ) : (
              <Video className="h-5 w-5" />
            )}
          </button>
        )}
        {callType === 'screen' && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <MonitorUp className="h-5 w-5" />
          </div>
        )}
        <button
          onClick={() => endCall(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-error text-white shadow-lg transition-transform hover:scale-105"
          aria-label="End call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
