'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { loadYouTubeIframeApi } from './youtube';

export interface WatchPlayerHandle {
  loadVideo: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
}

interface WatchPlayerProps {
  /** Local play/pause/seek the player initiates — used to emit sync events. */
  onLocalPlay: (time: number) => void;
  onLocalPause: (time: number) => void;
  onLocalSeek: (time: number) => void;
  onReady?: () => void;
}

/**
 * Wraps a `YT.Player` instance and exposes an imperative handle so the parent
 * can apply remote sync actions. Local state changes are reported via the
 * onLocal* callbacks (the parent guards against feedback loops).
 */
export const WatchPlayer = forwardRef<WatchPlayerHandle, WatchPlayerProps>(
  function WatchPlayer({ onLocalPlay, onLocalPause, onLocalSeek, onReady }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<any>(null);
    const lastTimeRef = useRef(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Keep latest callbacks without re-initialising the player.
    const cbRef = useRef({ onLocalPlay, onLocalPause, onLocalSeek, onReady });
    useEffect(() => {
      cbRef.current = { onLocalPlay, onLocalPause, onLocalSeek, onReady };
    });

    useImperativeHandle(ref, () => ({
      loadVideo: (videoId: string) => {
        const p = playerRef.current;
        if (p?.loadVideoById) p.loadVideoById(videoId);
      },
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      seekTo: (seconds: number) => playerRef.current?.seekTo?.(seconds, true),
      getCurrentTime: () => {
        try {
          return playerRef.current?.getCurrentTime?.() ?? 0;
        } catch {
          return 0;
        }
      },
    }));

    useEffect(() => {
      let cancelled = false;

      loadYouTubeIframeApi().then((YT) => {
        if (cancelled || !containerRef.current) return;

        playerRef.current = new YT.Player(containerRef.current, {
          width: '100%',
          height: '100%',
          playerVars: {
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => cbRef.current.onReady?.(),
            onStateChange: (e: any) => {
              const time = playerRef.current?.getCurrentTime?.() ?? 0;
              // PLAYING = 1, PAUSED = 2
              if (e.data === YT.PlayerState.PLAYING) {
                cbRef.current.onLocalPlay(time);
              } else if (e.data === YT.PlayerState.PAUSED) {
                cbRef.current.onLocalPause(time);
              }
            },
          },
        });

        // Poll for seeks the API doesn't surface as discrete events.
        pollRef.current = setInterval(() => {
          const p = playerRef.current;
          if (!p?.getCurrentTime) return;
          let t = 0;
          try {
            t = p.getCurrentTime();
          } catch {
            return;
          }
          const drift = Math.abs(t - lastTimeRef.current);
          // A jump > 2s while playing implies a manual seek.
          if (drift > 2 && p.getPlayerState?.() === 1) {
            cbRef.current.onLocalSeek(t);
          }
          lastTimeRef.current = t;
        }, 1000);
      });

      return () => {
        cancelled = true;
        if (pollRef.current) clearInterval(pollRef.current);
        try {
          playerRef.current?.destroy?.();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
      };
    }, []);

    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  },
);
