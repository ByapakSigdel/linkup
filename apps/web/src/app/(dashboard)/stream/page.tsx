'use client';

import { Radio } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { LinkupMark } from '@/components/brand/logo';
import {
  useLiveStream,
  StreamStage,
  StreamControls,
} from '@/components/stream';

export default function StreamPage() {
  const couple = useAuthStore((s) => s.couple);

  const {
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
  } = useLiveStream();

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LinkupMark size={48} className="mb-4 opacity-90" />
        <h2 className="text-lg font-semibold text-text">Streaming</h2>
        <p className="mt-1 max-w-sm text-sm text-text-muted">
          Link up with your partner to share a live moment — your camera or your
          screen, watched together in real time.
        </p>
      </div>
    );
  }

  const subtitle =
    phase === 'broadcasting'
      ? source === 'screen'
        ? 'Your partner is watching your screen'
        : 'Your partner is watching your camera'
      : phase === 'watching'
        ? 'Live from your partner'
        : phase === 'partner-live'
          ? 'Your partner just went live'
          : 'Share a live moment with your partner';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light">
          <Radio className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Streaming</h1>
          <p className="text-sm text-text-muted">{subtitle}</p>
        </div>
      </div>

      <StreamStage
        phase={phase}
        source={source}
        receiving={receiving}
        endedNotice={endedNotice}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        onWatch={watch}
      />

      <StreamControls
        phase={phase}
        busy={busy}
        muted={muted}
        source={source}
        onGoLive={goLive}
        onStop={stopBroadcast}
        onWatch={watch}
        onLeave={leave}
        onToggleMute={toggleMute}
      />

      <p className="text-center text-xs text-text-muted/70">
        Streaming is one-way and peer-to-peer. Only your partner can watch.
      </p>
    </div>
  );
}
