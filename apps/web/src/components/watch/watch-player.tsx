'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { loadYouTubeIframeApi } from './youtube';

export interface WatchMedia {
  source: 'youtube' | 'url';
  /** YouTube video id when source==='youtube', else the direct media URL. */
  src: string;
}

export interface WatchPlayerHandle {
  load: (media: WatchMedia) => void;
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
  /** A direct media link failed to play. */
  onError?: (message: string) => void;
}

/**
 * Plays either a YouTube video (via the IFrame API) or a direct media link
 * (via a native <video>), exposing one imperative handle so the parent can
 * apply remote sync actions regardless of source. Local state changes are
 * reported via the onLocal* callbacks (the parent guards against feedback
 * loops). Both backends are mounted at once and shown/hidden by the active
 * source, so switching links is instant and the YouTube API is always warm.
 */
export const WatchPlayer = forwardRef<WatchPlayerHandle, WatchPlayerProps>(
  function WatchPlayer(
    { onLocalPlay, onLocalPause, onLocalSeek, onReady, onError },
    ref,
  ) {
    const ytContainerRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const ytPlayerRef = useRef<any>(null);
    const ytReadyRef = useRef(false);
    // Buffer a YouTube id to load once the IFrame API is ready.
    const pendingYtRef = useRef<string | null>(null);
    const lastTimeRef = useRef(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [active, setActive] = useState<'youtube' | 'url' | null>(null);
    const activeRef = useRef<'youtube' | 'url' | null>(null);
    useEffect(() => {
      activeRef.current = active;
    }, [active]);

    // Keep latest callbacks without re-initialising the players.
    const cbRef = useRef({ onLocalPlay, onLocalPause, onLocalSeek, onReady, onError });
    useEffect(() => {
      cbRef.current = { onLocalPlay, onLocalPause, onLocalSeek, onReady, onError };
    });

    useImperativeHandle(ref, () => ({
      load: (media: WatchMedia) => {
        if (media.source === 'youtube') {
          setActive('youtube');
          try {
            videoRef.current?.pause();
          } catch {
            /* ignore */
          }
          if (ytReadyRef.current && ytPlayerRef.current?.loadVideoById) {
            ytPlayerRef.current.loadVideoById(media.src);
          } else {
            pendingYtRef.current = media.src;
          }
        } else {
          setActive('url');
          try {
            ytPlayerRef.current?.pauseVideo?.();
          } catch {
            /* ignore */
          }
          const v = videoRef.current;
          if (v) {
            if (v.getAttribute('src') !== media.src) v.src = media.src;
            v.load();
          }
        }
      },
      play: () => {
        if (activeRef.current === 'url') {
          void videoRef.current?.play?.().catch(() => {});
        } else {
          ytPlayerRef.current?.playVideo?.();
        }
      },
      pause: () => {
        if (activeRef.current === 'url') videoRef.current?.pause?.();
        else ytPlayerRef.current?.pauseVideo?.();
      },
      seekTo: (seconds: number) => {
        if (activeRef.current === 'url') {
          const v = videoRef.current;
          if (v) {
            try {
              v.currentTime = seconds;
            } catch {
              /* ignore */
            }
          }
        } else {
          ytPlayerRef.current?.seekTo?.(seconds, true);
        }
      },
      getCurrentTime: () => {
        try {
          if (activeRef.current === 'url') return videoRef.current?.currentTime ?? 0;
          return ytPlayerRef.current?.getCurrentTime?.() ?? 0;
        } catch {
          return 0;
        }
      },
    }));

    // ---- YouTube IFrame init (once) ---------------------------------------
    useEffect(() => {
      let cancelled = false;

      loadYouTubeIframeApi()
        .then((YT) => {
          if (cancelled || !ytContainerRef.current) return;

          ytPlayerRef.current = new YT.Player(ytContainerRef.current, {
            width: '100%',
            height: '100%',
            playerVars: { modestbranding: 1, rel: 0, playsinline: 1 },
            events: {
              onReady: () => {
                ytReadyRef.current = true;
                cbRef.current.onReady?.();
                if (pendingYtRef.current) {
                  ytPlayerRef.current?.loadVideoById?.(pendingYtRef.current);
                  pendingYtRef.current = null;
                }
              },
              onStateChange: (e: any) => {
                if (activeRef.current !== 'youtube') return;
                const time = ytPlayerRef.current?.getCurrentTime?.() ?? 0;
                // PLAYING = 1, PAUSED = 2
                if (e.data === YT.PlayerState.PLAYING) {
                  cbRef.current.onLocalPlay(time);
                } else if (e.data === YT.PlayerState.PAUSED) {
                  cbRef.current.onLocalPause(time);
                }
              },
            },
          });

          // Poll for seeks the YT API doesn't surface as discrete events.
          pollRef.current = setInterval(() => {
            if (activeRef.current !== 'youtube') return;
            const p = ytPlayerRef.current;
            if (!p?.getCurrentTime) return;
            let t = 0;
            try {
              t = p.getCurrentTime();
            } catch {
              return;
            }
            const drift = Math.abs(t - lastTimeRef.current);
            if (drift > 2 && p.getPlayerState?.() === 1) {
              cbRef.current.onLocalSeek(t);
            }
            lastTimeRef.current = t;
          }, 1000);
        })
        .catch(() => {
          // YouTube API blocked/unavailable — direct video links still work.
        });

      return () => {
        cancelled = true;
        if (pollRef.current) clearInterval(pollRef.current);
        try {
          ytPlayerRef.current?.destroy?.();
        } catch {
          /* ignore */
        }
        ytPlayerRef.current = null;
      };
    }, []);

    // ---- Native <video> event wiring --------------------------------------
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      const onPlay = () => {
        if (activeRef.current === 'url') cbRef.current.onLocalPlay(v.currentTime);
      };
      const onPause = () => {
        if (activeRef.current === 'url') cbRef.current.onLocalPause(v.currentTime);
      };
      const onSeeked = () => {
        if (activeRef.current === 'url') cbRef.current.onLocalSeek(v.currentTime);
      };
      const onErr = () => {
        if (activeRef.current === 'url') {
          cbRef.current.onError?.('This video link could not be played.');
        }
      };
      v.addEventListener('play', onPlay);
      v.addEventListener('pause', onPause);
      v.addEventListener('seeked', onSeeked);
      v.addEventListener('error', onErr);
      return () => {
        v.removeEventListener('play', onPlay);
        v.removeEventListener('pause', onPause);
        v.removeEventListener('seeked', onSeeked);
        v.removeEventListener('error', onErr);
      };
    }, []);

    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
        {/* YouTube iframe target (default until a direct link is loaded) */}
        <div className={active === 'url' ? 'hidden' : 'h-full w-full'}>
          <div ref={ytContainerRef} className="h-full w-full" />
        </div>
        {/* Direct media element */}
        <video
          ref={videoRef}
          controls
          playsInline
          className={
            active === 'url' ? 'h-full w-full bg-black object-contain' : 'hidden'
          }
        />
      </div>
    );
  },
);
