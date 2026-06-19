'use client';

import { Radio, Play, Sparkles } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import { StreamStatusPill } from './stream-status-pill';
import type { StreamPhase, StreamSource } from './use-live-stream';

interface StreamStageProps {
  phase: StreamPhase;
  source: StreamSource | null;
  receiving: boolean;
  endedNotice: boolean;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  onWatch: () => void;
}

/**
 * The big black video stage. Shows the local preview while broadcasting, the
 * remote feed while watching, and friendly placeholders for every other state.
 * The <video> elements are always mounted so refs stay stable across phases.
 */
export function StreamStage({
  phase,
  source,
  receiving,
  endedNotice,
  localVideoRef,
  remoteVideoRef,
  onWatch,
}: StreamStageProps) {
  const showLocal = phase === 'broadcasting';
  const showRemote = phase === 'watching';

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
      {/* Local preview (broadcaster). Muted to avoid echo. */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className={
          showLocal
            ? 'h-full w-full object-contain'
            : 'pointer-events-none absolute h-0 w-0 opacity-0'
        }
      />

      {/* Remote feed (viewer). */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={
          showRemote && receiving
            ? 'h-full w-full object-contain'
            : 'pointer-events-none absolute h-0 w-0 opacity-0'
        }
      />

      {/* Status pill — only while a live session is active or pending. */}
      {phase !== 'idle' && (
        <StreamStatusPill phase={phase} className="absolute left-4 top-4 z-10" />
      )}

      {/* Broadcaster source hint */}
      {showLocal && (
        <div className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
          {source === 'screen' ? 'Sharing screen' : 'Camera'}
        </div>
      )}

      {/* Idle / empty state */}
      {phase === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          {endedNotice ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <Radio className="h-7 w-7 text-white/40" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white/90">
                  Stream ended
                </p>
                <p className="mt-1 max-w-sm text-sm text-white/50">
                  Your partner stopped streaming. Start your own anytime.
                </p>
              </div>
            </>
          ) : (
            <>
              <LinkupMark size={56} className="opacity-90" />
              <div>
                <p className="text-lg font-semibold text-white/90">
                  Share a live moment with your partner
                </p>
                <p className="mt-1 max-w-sm text-sm text-white/50">
                  Go live with your camera or share your screen — they&apos;ll
                  watch it in real time.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Partner is live — watch CTA */}
      {phase === 'partner-live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent/15">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/20" />
            <Sparkles className="relative h-9 w-9 text-accent" />
          </div>
          <div>
            <p className="text-xl font-semibold text-white">
              Your partner is live
            </p>
            <p className="mt-1 text-sm text-white/50">
              Tune in to watch what they&apos;re sharing.
            </p>
          </div>
          <Button size="lg" shape="pill" onClick={onWatch}>
            <Play className="h-5 w-5" />
            Watch
          </Button>
        </div>
      )}

      {/* Watching but not yet receiving frames */}
      {showRemote && !receiving && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
          <Spinner size="lg" className="text-white/70" />
          <p className="text-sm text-white/60">Connecting to your partner…</p>
        </div>
      )}
    </div>
  );
}
