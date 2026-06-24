import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Minimize2,
  Gamepad2,
} from 'lucide-react-native';
import { connectSocket, getSocket } from '@/lib/socket';
import { useCallStore } from '@/stores/call-store';
import { useAuthStore } from '@/stores/auth-store';
import { useTheme } from '@/theme';
import { AppText, Avatar } from '@/components/ui';
import api from '@/lib/api';

/**
 * WebRTC native bindings are loaded lazily and defensively: the rest of the app
 * runs fine in Expo Go (where the native module is absent) — calls simply show a
 * "needs the full app build" notice. In a dev/production build the engine is
 * present and real peer-to-peer audio/video works, mirroring the web CallManager.
 */
type RTCMod = typeof import('react-native-webrtc');
let RTC: RTCMod | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  RTC = require('react-native-webrtc') as RTCMod;
} catch {
  RTC = null;
}
const RTC_AVAILABLE = !!RTC?.RTCPeerConnection;

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export function CallManager() {
  const { colors } = useTheme();
  const phase = useCallStore((s) => s.phase);
  const callType = useCallStore((s) => s.callType);
  const peer = useCallStore((s) => s.peer);
  const muted = useCallStore((s) => s.muted);
  const cameraOff = useCallStore((s) => s.cameraOff);
  const minimized = useCallStore((s) => s.minimized);
  const setMinimized = useCallStore((s) => s.setMinimized);
  const token = useAuthStore((s) => s.tokens?.accessToken);

  const pcRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const pendingIce = useRef<any[]>([]);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'in-call') {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const cleanup = () => {
    try {
      pcRef.current?.getSenders?.().forEach((s: any) => s.track?.stop());
      pcRef.current?.close?.();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    try {
      localStreamRef.current?.getTracks?.().forEach((t: any) => t.stop());
    } catch {
      /* ignore */
    }
    localStreamRef.current = null;
    pendingIce.current = [];
    setLocalStream(null);
    setRemoteStream(null);
  };

  const endCall = (notify = true) => {
    if (notify) getSocket()?.emit('call:end');
    const recId = useCallStore.getState().callRecordId;
    const started = useCallStore.getState().startedAt;
    if (recId) {
      const durationSec = started ? Math.round((Date.now() - started) / 1000) : 0;
      api.patch(`/entertainment/calls/${recId}`, { status: 'ended', durationSec }).catch(() => {});
    }
    cleanup();
    useCallStore.getState().reset();
  };

  async function getMedia(type: string): Promise<any> {
    const md: any = RTC!.mediaDevices;
    if (type === 'screen' && typeof md.getDisplayMedia === 'function') {
      try {
        return await md.getDisplayMedia();
      } catch {
        /* fall back to camera below */
      }
    }
    return md.getUserMedia({ audio: true, video: type === 'video' || type === 'screen' });
  }

  function createPeer(): any {
    const pc = new (RTC!.RTCPeerConnection as any)(ICE_CONFIG);
    pc.addEventListener('icecandidate', (e: any) => {
      if (e.candidate) getSocket()?.emit('call:ice', { candidate: e.candidate });
    });
    pc.addEventListener('track', (e: any) => {
      const stream = e.streams?.[0];
      if (stream) setRemoteStream(stream);
    });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') useCallStore.getState().setInCall();
    });
    return pc;
  }

  async function attachLocal(type: string) {
    const stream = await getMedia(type);
    localStreamRef.current = stream;
    setLocalStream(stream);
    stream.getTracks().forEach((t: any) => pcRef.current?.addTrack(t, stream));
  }

  // Signaling listeners — mirror the web CallManager exactly.
  useEffect(() => {
    if (!token || !RTC_AVAILABLE) return;
    const socket = connectSocket(token);
    if (!socket) return;

    const onAccepted = async () => {
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

    const onOffer = async (data: { sdp: any }) => {
      try {
        if (!pcRef.current) pcRef.current = createPeer();
        if (!localStreamRef.current) await attachLocal(useCallStore.getState().callType);
        await pcRef.current.setRemoteDescription(new (RTC!.RTCSessionDescription as any)(data.sdp));
        for (const c of pendingIce.current) {
          await pcRef.current.addIceCandidate(new (RTC!.RTCIceCandidate as any)(c));
        }
        pendingIce.current = [];
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit('call:answer', { sdp: answer });
      } catch {
        endCall();
      }
    };

    const onAnswer = async (data: { sdp: any }) => {
      try {
        await pcRef.current?.setRemoteDescription(new (RTC!.RTCSessionDescription as any)(data.sdp));
        for (const c of pendingIce.current) {
          await pcRef.current?.addIceCandidate(new (RTC!.RTCIceCandidate as any)(c));
        }
        pendingIce.current = [];
      } catch {
        /* ignore */
      }
    };

    const onIce = async (data: { candidate: any }) => {
      try {
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(new (RTC!.RTCIceCandidate as any)(data.candidate));
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
  }, [token]);

  async function acceptIncoming() {
    if (!RTC_AVAILABLE) return;
    useCallStore.getState().setConnecting();
    getSocket()?.emit('call:accept');
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
    cleanup();
    useCallStore.getState().reset();
  }

  function toggleMute() {
    const next = !muted;
    localStreamRef.current?.getAudioTracks?.().forEach((t: any) => (t.enabled = !next));
    useCallStore.getState().setMuted(next);
  }

  function toggleCamera() {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks?.().forEach((t: any) => (t.enabled = !next));
    useCallStore.getState().setCameraOff(next);
  }

  // Shrink the call to a floating bubble and jump to the games hub so the couple
  // can play/watch/draw together while the call keeps running.
  function openActivities() {
    setMinimized(true);
    router.push('/games');
  }

  if (phase === 'idle') return null;

  const showVideo = callType === 'video' || callType === 'screen';
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const RTCView: any = RTC?.RTCView;

  const RoundBtn = ({
    onPress,
    bg,
    children,
    big,
  }: {
    onPress: () => void;
    bg: string;
    children: React.ReactNode;
    big?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: big ? 64 : 52,
        height: big ? 64 : 52,
        borderRadius: 999,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {children}
    </Pressable>
  );

  // Incoming prompt
  if (phase === 'incoming') {
    return (
      <Modal transparent animationType="fade" visible onRequestClose={declineIncoming}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <View style={{ width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: colors.surface, padding: 28, alignItems: 'center' }}>
            <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={84} />
            <AppText variant="title" style={{ marginTop: 14 }}>{peer?.displayName || 'Partner'}</AppText>
            <AppText muted style={{ marginTop: 2 }}>
              {RTC_AVAILABLE ? `Incoming ${callType} call…` : 'Incoming call — needs the full app build'}
            </AppText>
            <View style={{ flexDirection: 'row', gap: 28, marginTop: 28 }}>
              <RoundBtn onPress={declineIncoming} bg={colors.error} big>
                <PhoneOff color="#fff" size={26} />
              </RoundBtn>
              {RTC_AVAILABLE && (
                <RoundBtn onPress={acceptIncoming} bg={colors.success} big>
                  <Phone color="#fff" size={26} />
                </RoundBtn>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Minimized: a floating bubble that keeps the call alive while the couple uses
  // the rest of the app. Tap to expand; the WebRTC connection is untouched.
  if (minimized) {
    return (
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 60, right: 16, zIndex: 9999 }}
      >
        <Pressable
          onPress={() => setMinimized(false)}
          accessibilityRole="button"
          accessibilityLabel={`Return to call with ${peer?.displayName || 'partner'}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: 'rgba(12,12,16,0.94)',
            borderRadius: 999,
            paddingVertical: 8,
            paddingLeft: 8,
            paddingRight: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={36} />
          <View>
            <AppText color="#fff" variant="label">
              {peer?.displayName || 'Partner'}
            </AppText>
            <AppText color={colors.success} variant="caption">
              {phase === 'in-call'
                ? fmt(elapsed)
                : phase === 'connecting'
                  ? 'Connecting…'
                  : 'Calling…'}
            </AppText>
          </View>
          <Pressable
            onPress={() => endCall(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="End call"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: colors.error,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 2,
            }}
          >
            <PhoneOff color="#fff" size={16} />
          </Pressable>
        </Pressable>
      </View>
    );
  }

  // Active / calling window
  return (
    <Modal transparent={false} animationType="slide" visible onRequestClose={() => setMinimized(true)}>
      <View style={{ flex: 1, backgroundColor: '#0c0c10' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {showVideo && RTCView && remoteStream ? (
            <RTCView streamURL={remoteStream.toURL()} objectFit="contain" style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ alignItems: 'center', gap: 14 }}>
              <Avatar uri={peer?.avatarUrl} name={peer?.displayName} size={96} />
              <AppText variant="title" color="#fff">{peer?.displayName || 'Partner'}</AppText>
            </View>
          )}

          {showVideo && RTCView && localStream && !cameraOff ? (
            <View style={{ position: 'absolute', right: 16, bottom: 16, width: 100, height: 150, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
              <RTCView streamURL={localStream.toURL()} objectFit="cover" mirror zOrder={1} style={{ width: '100%', height: '100%' }} />
            </View>
          ) : null}

          <View style={{ position: 'absolute', top: 56, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 }}>
            <AppText color="#fff" variant="label">
              {!RTC_AVAILABLE
                ? 'Calls need the full app build'
                : phase === 'calling'
                  ? `Calling ${peer?.displayName || 'partner'}…`
                  : phase === 'connecting'
                    ? 'Connecting…'
                    : fmt(elapsed)}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 26 }}>
          <RoundBtn onPress={() => setMinimized(true)} bg="rgba(255,255,255,0.16)">
            <Minimize2 color="#fff" size={22} />
          </RoundBtn>
          {RTC_AVAILABLE && (
            <RoundBtn onPress={toggleMute} bg="rgba(255,255,255,0.16)">
              {muted ? <MicOff color="#fff" size={22} /> : <Mic color="#fff" size={22} />}
            </RoundBtn>
          )}
          {RTC_AVAILABLE && callType === 'video' && (
            <RoundBtn onPress={toggleCamera} bg="rgba(255,255,255,0.16)">
              {cameraOff ? <VideoOff color="#fff" size={22} /> : <Video color="#fff" size={22} />}
            </RoundBtn>
          )}
          {/* Shrink the call and open games/watch/draw — keep talking while you play. */}
          <RoundBtn onPress={openActivities} bg="rgba(255,255,255,0.16)">
            <Gamepad2 color="#fff" size={22} />
          </RoundBtn>
          <RoundBtn onPress={() => endCall(true)} bg={colors.error} big>
            <PhoneOff color="#fff" size={26} />
          </RoundBtn>
        </View>
      </View>
    </Modal>
  );
}
