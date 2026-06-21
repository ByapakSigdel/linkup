import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View, useWindowDimensions } from 'react-native';
import YoutubePlayer, {
  PLAYER_STATES,
  type YoutubeIframeRef,
} from 'react-native-youtube-iframe';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTheme } from '@/theme';

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
 * Plays either a YouTube video (via react-native-youtube-iframe) or a direct
 * media link (via expo-video), exposing one imperative handle so the parent can
 * apply remote sync actions regardless of source. Local state changes are
 * reported via the onLocal* callbacks (the parent guards against feedback
 * loops). Mirrors the web WatchPlayer's behaviour: one control surface, the
 * active backend chosen by the loaded media's source.
 */
export const WatchPlayer = forwardRef<WatchPlayerHandle, WatchPlayerProps>(
  function WatchPlayer(
    { onLocalPlay, onLocalPause, onLocalSeek, onReady, onError },
    ref,
  ) {
    const { colors, radius } = useTheme();
    const { width } = useWindowDimensions();

    const [active, setActive] = useState<'youtube' | 'url' | null>(null);
    const activeRef = useRef<'youtube' | 'url' | null>(null);
    useEffect(() => {
      activeRef.current = active;
    }, [active]);

    // ---- YouTube state ----------------------------------------------------
    const ytRef = useRef<YoutubeIframeRef | null>(null);
    const [ytId, setYtId] = useState<string | null>(null);
    const [ytPlaying, setYtPlaying] = useState(false);
    const ytReadyRef = useRef(false);
    const ytTimeRef = useRef(0); // last polled YT time (seconds)
    const lastSeekRef = useRef(0);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ---- Direct-video (expo-video) state ----------------------------------
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const player = useVideoPlayer(null, (p) => {
      p.timeUpdateEventInterval = 0.5;
    });

    // Keep latest callbacks without re-wiring listeners.
    const cbRef = useRef({ onLocalPlay, onLocalPause, onLocalSeek, onReady, onError });
    useEffect(() => {
      cbRef.current = { onLocalPlay, onLocalPause, onLocalSeek, onReady, onError };
    });

    // ---- expo-video event wiring ------------------------------------------
    const { isPlaying } = useEvent(player, 'playingChange', {
      isPlaying: player.playing,
    });
    const prevPlayingRef = useRef(player.playing);
    useEffect(() => {
      if (activeRef.current !== 'url') {
        prevPlayingRef.current = isPlaying;
        return;
      }
      if (isPlaying === prevPlayingRef.current) return;
      prevPlayingRef.current = isPlaying;
      const t = player.currentTime ?? 0;
      if (isPlaying) cbRef.current.onLocalPlay(t);
      else cbRef.current.onLocalPause(t);
    }, [isPlaying, player]);

    const { status, error } = useEvent(player, 'statusChange', {
      status: player.status,
    });
    useEffect(() => {
      if (activeRef.current === 'url' && status === 'error') {
        cbRef.current.onError?.(
          error?.message ?? 'This video link could not be played.',
        );
      }
    }, [status, error]);

    // Direct-video seek detection: timeUpdate fires steadily during playback;
    // a jump larger than the interval implies the user scrubbed.
    const urlTimeRef = useRef(0);
    const { currentTime: urlTime } = useEvent(player, 'timeUpdate', {
      currentTime: player.currentTime,
      currentLiveTimestamp: null,
      currentOffsetFromLive: null,
      bufferedPosition: 0,
    });
    useEffect(() => {
      if (activeRef.current !== 'url') {
        urlTimeRef.current = urlTime;
        return;
      }
      const drift = Math.abs(urlTime - urlTimeRef.current);
      // Expected step is ~0.5s (timeUpdateEventInterval); >2s means a seek.
      if (drift > 2) cbRef.current.onLocalSeek(urlTime);
      urlTimeRef.current = urlTime;
    }, [urlTime]);

    // ---- YouTube poll for seeks (mirrors web's 1s poll) -------------------
    useEffect(() => {
      pollRef.current = setInterval(() => {
        if (activeRef.current !== 'youtube' || !ytReadyRef.current) return;
        const p = ytRef.current;
        if (!p) return;
        p.getCurrentTime()
          .then((t) => {
            const drift = Math.abs(t - ytTimeRef.current);
            // Only treat as a deliberate seek while playing, like the web poll.
            if (drift > 2 && ytPlaying) {
              lastSeekRef.current = t;
              cbRef.current.onLocalSeek(t);
            }
            ytTimeRef.current = t;
          })
          .catch(() => {});
      }, 1000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      };
    }, [ytPlaying]);

    const onYtReady = useCallback(() => {
      ytReadyRef.current = true;
      cbRef.current.onReady?.();
    }, []);

    const onYtStateChange = useCallback((state: PLAYER_STATES) => {
      if (activeRef.current !== 'youtube') return;
      const p = ytRef.current;
      const report = (cb: (t: number) => void) => {
        if (p) p.getCurrentTime().then((t) => cb(t)).catch(() => cb(ytTimeRef.current));
        else cb(ytTimeRef.current);
      };
      if (state === PLAYER_STATES.PLAYING) {
        setYtPlaying(true);
        report((t) => cbRef.current.onLocalPlay(t));
      } else if (state === PLAYER_STATES.PAUSED) {
        setYtPlaying(false);
        report((t) => cbRef.current.onLocalPause(t));
      } else if (state === PLAYER_STATES.ENDED) {
        setYtPlaying(false);
      }
    }, []);

    const onYtError = useCallback((e: string) => {
      cbRef.current.onError?.(`YouTube playback error: ${e}`);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        load: (media: WatchMedia) => {
          if (media.source === 'youtube') {
            setActive('youtube');
            // Pause any direct video that was playing.
            try {
              player.pause();
            } catch {
              /* ignore */
            }
            ytTimeRef.current = 0;
            setYtId(media.src);
          } else {
            setActive('url');
            // Pause YouTube if it was playing.
            setYtPlaying(false);
            setVideoUri(media.src);
            try {
              player.replace(media.src);
            } catch {
              /* ignore */
            }
          }
        },
        play: () => {
          if (activeRef.current === 'url') {
            try {
              player.play();
            } catch {
              /* ignore */
            }
          } else {
            setYtPlaying(true);
          }
        },
        pause: () => {
          if (activeRef.current === 'url') {
            try {
              player.pause();
            } catch {
              /* ignore */
            }
          } else {
            setYtPlaying(false);
          }
        },
        seekTo: (seconds: number) => {
          if (activeRef.current === 'url') {
            try {
              player.currentTime = seconds;
            } catch {
              /* ignore */
            }
          } else {
            ytTimeRef.current = seconds;
            ytRef.current?.seekTo(seconds, true);
          }
        },
        getCurrentTime: () => {
          if (activeRef.current === 'url') {
            try {
              return player.currentTime ?? 0;
            } catch {
              return 0;
            }
          }
          return ytTimeRef.current;
        },
      }),
      [player],
    );

    // 16:9 box sized to the available width.
    const boxWidth = Math.min(width - 32, 720);
    const boxHeight = Math.round((boxWidth * 9) / 16);

    return (
      <View
        style={{
          width: '100%',
          height: boxHeight,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#000',
          overflow: 'hidden',
        }}
      >
        {active === 'url' && videoUri ? (
          <VideoView
            player={player}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            nativeControls
          />
        ) : ytId ? (
          <YoutubePlayer
            ref={ytRef}
            height={boxHeight}
            width={boxWidth}
            videoId={ytId}
            play={ytPlaying}
            onReady={onYtReady}
            onChangeState={onYtStateChange}
            onError={onYtError}
            initialPlayerParams={{ rel: false, controls: true }}
            webViewProps={{ allowsInlineMediaPlayback: true }}
          />
        ) : null}
      </View>
    );
  },
);
