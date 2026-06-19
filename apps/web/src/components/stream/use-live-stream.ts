'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';
import { useToastStore } from '@/stores/toast-store';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The four states the page can be in. A single page handles both roles:
 *  - idle:          nothing happening, can choose to go live
 *  - broadcasting:  we are the broadcaster sending our camera/screen
 *  - partner-live:  partner started a stream; we can choose to watch
 *  - watching:      we are receiving + viewing the partner's stream
 */
export type StreamPhase = 'idle' | 'broadcasting' | 'watching' | 'partner-live';

export type StreamSource = 'camera' | 'screen';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

interface LiveStreamApi {
  phase: StreamPhase;
  /** What the broadcaster is sharing (only meaningful while broadcasting). */
  source: StreamSource | null;
  /** True while acquiring media / negotiating, for button spinners. */
  busy: boolean;
  /** Broadcaster mic muted state. */
  muted: boolean;
  /** Set once a viewer has received remote tracks. */
  receiving: boolean;
  /** Shown briefly after a partner's stream ends. */
  endedNotice: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  goLive: (source: StreamSource) => Promise<void>;
  stopBroadcast: () => void;
  watch: () => void;
  leave: () => void;
  toggleMute: () => void;
  dismissEndedNotice: () => void;
}

/**
 * Owns the WebRTC peer connection, local media, and all signaling for the
 * one-way Live Streaming feature. Signaling is relayed through the shared
 * socket; the gateway forwards each event to the partner.
 */
export function useLiveStream(): LiveStreamApi {
  const [phase, setPhase] = useState<StreamPhase>('idle');
  const [source, setSource] = useState<StreamSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [endedNotice, setEndedNotice] = useState(false);
  const token = useAuthStore((s) => s.tokens?.accessToken);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Tracks the live phase inside async callbacks without stale closures.
  const phaseRef = useRef<StreamPhase>('idle');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const toast = useCallback(
    (title: string, body?: string, variant: 'default' | 'info' = 'info') => {
      useToastStore.getState().push({ title, body, variant });
    },
    [],
  );

  /** Tear down the peer connection, local media, and buffered candidates. */
  const teardown = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingIce.current = [];
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setReceiving(false);
    setMuted(false);
  }, []);

  /** Apply any ICE candidates that arrived before the remote description. */
  const flushPendingIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const c of pendingIce.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* ignore malformed candidate */
      }
    }
    pendingIce.current = [];
  }, []);

  // ----- Broadcaster -----

  const goLive = useCallback(
    async (src: StreamSource) => {
      if (phaseRef.current === 'broadcasting' || busy) return;
      const socket = getSocket();
      if (!socket) {
        toast('Not connected', 'Reconnecting… please try again in a moment.');
        return;
      }

      setBusy(true);
      let stream: MediaStream;
      try {
        stream =
          src === 'screen'
            ? await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true,
              })
            : await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
              });
      } catch (err) {
        setBusy(false);
        const denied =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'SecurityError');
        toast(
          denied ? 'Permission needed' : 'Could not start stream',
          denied
            ? src === 'screen'
              ? 'Screen sharing was blocked. Allow it to go live.'
              : 'Camera and microphone access were blocked.'
            : 'We could not access your camera or screen.',
        );
        return;
      }

      try {
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setSource(src);
        setMuted(false);
        setPhase('broadcasting');
        phaseRef.current = 'broadcasting';

        socket.emit('stream:start');

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            getSocket()?.emit('stream:ice', { candidate: e.candidate });
          }
        };
        pc.onnegotiationneeded = async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            getSocket()?.emit('stream:offer', { sdp: offer });
          } catch {
            /* will retry on viewer (re)join */
          }
        };

        // When the screen share is stopped via the browser's own UI.
        stream.getVideoTracks().forEach((t) => {
          t.addEventListener('ended', () => {
            if (phaseRef.current === 'broadcasting') stopBroadcastRef.current();
          });
        });

        // Adding tracks triggers negotiationneeded, which creates the offer.
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      } catch {
        toast('Could not start stream', 'Something went wrong setting up.');
        teardown();
        setSource(null);
        setPhase('idle');
        phaseRef.current = 'idle';
      } finally {
        setBusy(false);
      }
    },
    [busy, teardown, toast],
  );

  const stopBroadcast = useCallback(() => {
    if (phaseRef.current === 'broadcasting') {
      getSocket()?.emit('stream:stop');
    }
    teardown();
    setSource(null);
    setPhase('idle');
    phaseRef.current = 'idle';
  }, [teardown]);

  // Stable ref so the track 'ended' listener can call the latest version.
  const stopBroadcastRef = useRef(stopBroadcast);
  useEffect(() => {
    stopBroadcastRef.current = stopBroadcast;
  }, [stopBroadcast]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  // ----- Viewer -----

  const watch = useCallback(() => {
    if (phaseRef.current !== 'partner-live') return;
    // Create the receiving peer connection. The broadcaster's offer arrives
    // (or has already arrived and we re-request via a fresh negotiation) and
    // we answer it. ontrack attaches the incoming stream to the <video>.
    if (!pcRef.current) {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          getSocket()?.emit('stream:ice', { candidate: e.candidate });
        }
      };
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (stream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          setReceiving(true);
        }
      };
    }
    setPhase('watching');
    phaseRef.current = 'watching';
    // Nudge the broadcaster to (re)send an offer in case theirs predated us.
    getSocket()?.emit('stream:start');
  }, []);

  const leave = useCallback(() => {
    teardown();
    // Partner may still be broadcasting; return to the "partner is live" CTA.
    setPhase('partner-live');
    phaseRef.current = 'partner-live';
  }, [teardown]);

  const dismissEndedNotice = useCallback(() => setEndedNotice(false), []);

  // ----- Signaling -----

  useEffect(() => {
    if (!token) return;
    // Ensure a live socket even if this page mounted before the realtime
    // provider connected — child effects run before parent effects, so the
    // socket is null at first mount, which is exactly why streaming never armed
    // its listeners and "didn't work at all" on a fresh load.
    const socket = getSocket() ?? connectSocket(token);

    // Re-send our current offer so a viewer who just arrived (or pressed Watch)
    // receives it and can connect. Reuses the existing local description, so
    // it's safe to call repeatedly without glare.
    const resendOffer = () => {
      const pc = pcRef.current;
      if (pc?.localDescription) {
        getSocket()?.emit('stream:offer', { sdp: pc.localDescription });
      }
    };

    const onStarted = () => {
      setEndedNotice(false);
      if (phaseRef.current === 'broadcasting') {
        // A viewer joined / pressed Watch — make sure they get our offer.
        resendOffer();
        return;
      }
      if (phaseRef.current === 'idle') {
        setPhase('partner-live');
        phaseRef.current = 'partner-live';
      }
    };

    // A partner just opened the stream page; if we're live, send our offer so
    // they connect even though they missed the original "started" broadcast.
    const onHello = () => {
      if (phaseRef.current === 'broadcasting') resendOffer();
    };

    const onStopped = () => {
      if (phaseRef.current === 'broadcasting') return;
      teardown();
      const wasViewer =
        phaseRef.current === 'watching' || phaseRef.current === 'partner-live';
      setPhase('idle');
      phaseRef.current = 'idle';
      if (wasViewer) setEndedNotice(true);
    };

    const onOffer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      // Viewer side: we received the broadcaster's offer.
      if (phaseRef.current === 'broadcasting') return;
      try {
        let pc = pcRef.current;
        if (!pc) {
          // Offer arrived before the user pressed "Watch" — set up now.
          pc = new RTCPeerConnection(RTC_CONFIG);
          pcRef.current = pc;
          pc.onicecandidate = (e) => {
            if (e.candidate) {
              getSocket()?.emit('stream:ice', { candidate: e.candidate });
            }
          };
          pc.ontrack = (e) => {
            const [stream] = e.streams;
            if (stream && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              setReceiving(true);
            }
          };
          // Auto-enter watching since the partner is clearly live.
          setPhase('watching');
          phaseRef.current = 'watching';
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        await flushPendingIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket()?.emit('stream:answer', { sdp: answer });
      } catch {
        /* the broadcaster can renegotiate */
      }
    };

    const onAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      // Broadcaster side: viewer answered our offer.
      if (phaseRef.current !== 'broadcasting') return;
      try {
        await pcRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.sdp),
        );
        await flushPendingIce();
      } catch {
        /* ignore */
      }
    };

    const onIce = async (data: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      try {
        if (pc?.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
          // Buffer until the remote description is set, then flush.
          pendingIce.current.push(data.candidate);
        }
      } catch {
        /* ignore */
      }
    };

    socket.on('stream:started', onStarted);
    socket.on('stream:hello', onHello);
    socket.on('stream:stopped', onStopped);
    socket.on('stream:offer', onOffer);
    socket.on('stream:answer', onAnswer);
    socket.on('stream:ice', onIce);

    // Announce presence so a partner who is already live re-sends their offer.
    socket.emit('stream:hello');

    return () => {
      socket.off('stream:started', onStarted);
      socket.off('stream:hello', onHello);
      socket.off('stream:stopped', onStopped);
      socket.off('stream:offer', onOffer);
      socket.off('stream:answer', onAnswer);
      socket.off('stream:ice', onIce);
    };
  }, [flushPendingIce, teardown, token]);

  // Safety net: stop any active broadcast / teardown on unmount.
  useEffect(() => {
    return () => {
      if (phaseRef.current === 'broadcasting') {
        getSocket()?.emit('stream:stop');
      }
      teardown();
    };
  }, [teardown]);

  return {
    phase,
    source,
    busy,
    muted,
    receiving,
    endedNotice,
    localVideoRef,
    remoteVideoRef,
    goLive,
    stopBroadcast,
    watch,
    leave,
    toggleMute,
    dismissEndedNotice,
  };
}
