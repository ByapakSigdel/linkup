'use client';

import {
  Video,
  MonitorUp,
  Square,
  Mic,
  MicOff,
  Play,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui';
import type { StreamPhase, StreamSource } from './use-live-stream';

interface StreamControlsProps {
  phase: StreamPhase;
  busy: boolean;
  muted: boolean;
  source: StreamSource | null;
  onGoLive: (source: StreamSource) => void;
  onStop: () => void;
  onWatch: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}

/**
 * Phase-aware control bar. Renders only the actions that make sense for the
 * current state of the stream.
 */
export function StreamControls({
  phase,
  busy,
  muted,
  source,
  onGoLive,
  onStop,
  onWatch,
  onLeave,
  onToggleMute,
}: StreamControlsProps) {
  if (phase === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          size="lg"
          shape="pill"
          loading={busy}
          onClick={() => onGoLive('camera')}
          className="w-full sm:w-auto"
        >
          <Video className="h-5 w-5" />
          Go live with camera
        </Button>
        <Button
          size="lg"
          shape="pill"
          variant="outline"
          disabled={busy}
          onClick={() => onGoLive('screen')}
          className="w-full sm:w-auto"
        >
          <MonitorUp className="h-5 w-5" />
          Share screen
        </Button>
      </div>
    );
  }

  if (phase === 'broadcasting') {
    return (
      <div className="flex items-center justify-center gap-3">
        {source === 'camera' && (
          <Button
            size="lg"
            shape="pill"
            variant="outline"
            onClick={onToggleMute}
            aria-pressed={muted}
          >
            {muted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
            {muted ? 'Unmute' : 'Mute'}
          </Button>
        )}
        <Button
          size="lg"
          shape="pill"
          variant="destructive"
          onClick={onStop}
        >
          <Square className="h-5 w-5" />
          Stop streaming
        </Button>
      </div>
    );
  }

  if (phase === 'partner-live') {
    return (
      <div className="flex items-center justify-center">
        <Button size="lg" shape="pill" onClick={onWatch}>
          <Play className="h-5 w-5" />
          Watch
        </Button>
      </div>
    );
  }

  // watching
  return (
    <div className="flex items-center justify-center">
      <Button size="lg" shape="pill" variant="outline" onClick={onLeave}>
        <LogOut className="h-5 w-5" />
        Leave
      </Button>
    </div>
  );
}
