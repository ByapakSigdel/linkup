import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Play, Pause } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/env';
import type { MessageType } from '@/types';

interface MediaMessageProps {
  /** Array of media URLs attached to a message (may be relative API paths). */
  mediaUrls: string[];
  /** Whether this message was sent by the current user. */
  isSent: boolean;
  /** Tap handler to open a full viewer. */
  onImagePress?: (url: string, index: number) => void;
  /** The message type — used to render voice / scribble specially. */
  messageType?: MessageType;
}

const AUDIO_EXTS = ['webm', 'mp3', 'wav', 'ogg', 'm4a', 'oga'];

function getExt(url: string): string {
  return url.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
}
function isAudio(url: string): boolean {
  return AUDIO_EXTS.includes(getExt(url));
}
function isVideoFile(url: string): boolean {
  const ext = getExt(url);
  return ext === 'mp4' || ext === 'mov' || ext === 'avi' || ext === 'mkv';
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── Voice player ─────────────────────────────────────────────────────────── */
function VoicePlayer({ uri, isSent }: { uri: string; isSent: boolean }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const fg = isSent ? colors.messageSentText : colors.messageReceivedText;

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= (status.duration || 0)) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  const progress =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <View style={styles.voiceRow}>
      <Pressable
        onPress={toggle}
        hitSlop={8}
        style={[styles.voiceBtn, { backgroundColor: fg + '22' }]}
      >
        {status.playing ? (
          <Pause color={fg} size={18} fill={fg} />
        ) : (
          <Play color={fg} size={18} fill={fg} />
        )}
      </Pressable>
      <View style={styles.voiceTrackWrap}>
        <View style={[styles.voiceTrack, { backgroundColor: fg + '33' }]}>
          <View
            style={[
              styles.voiceFill,
              { backgroundColor: fg, width: `${progress * 100}%` },
            ]}
          />
        </View>
      </View>
      <AppText variant="caption" color={fg} style={styles.voiceTime}>
        {formatTime(status.playing || status.currentTime > 0 ? status.currentTime : status.duration)}
      </AppText>
    </View>
  );
}

/* ─── Video tile ───────────────────────────────────────────────────────────── */
function VideoTile({ uri, style }: { uri: string; style?: object }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      contentFit="cover"
      nativeControls
    />
  );
}

/* ─── Image tile ───────────────────────────────────────────────────────────── */
function ImageTile({
  uri,
  onPress,
  style,
}: {
  uri: string;
  onPress?: () => void;
  style?: object;
}) {
  return (
    <Pressable onPress={onPress} style={style}>
      <Image source={{ uri }} style={styles.fill} contentFit="cover" transition={150} />
    </Pressable>
  );
}

/**
 * Renders media attachments (images/videos/voice/scribble) within a chat
 * bubble. Mirrors apps/web/src/components/chat/media-message.tsx layouts:
 * single, 2-up side-by-side, and 3+ grid with a "+N" overlay.
 */
export function MediaMessage({
  mediaUrls,
  isSent,
  onImagePress,
  messageType,
}: MediaMessageProps) {
  const { colors, radius } = useTheme();
  const [failed] = useState(false);
  if (!mediaUrls || mediaUrls.length === 0 || failed) return null;

  const resolved = mediaUrls
    .map((u) => resolveMediaUrl(u))
    .filter((u): u is string => !!u);
  if (resolved.length === 0) return null;

  // ─── Voice ───────────────────────────────────────────────────────────────
  if (messageType === 'voice' || (resolved.length === 1 && isAudio(mediaUrls[0]!))) {
    return <VoicePlayer uri={resolved[0]!} isSent={isSent} />;
  }

  // ─── Scribble ──────────────────────────────────────────────────────────────
  if (messageType === 'scribble') {
    const url = resolved[0]!;
    return (
      <ImageTile
        uri={url}
        onPress={() => onImagePress?.(url, 0)}
        style={[styles.single, { borderRadius: radius.card, backgroundColor: '#ffffff10' }]}
      />
    );
  }

  // ─── Single media ──────────────────────────────────────────────────────────
  if (resolved.length === 1) {
    const url = resolved[0]!;
    if (isVideoFile(mediaUrls[0]!)) {
      return <VideoTile uri={url} style={[styles.single, { borderRadius: radius.card }]} />;
    }
    return (
      <ImageTile
        uri={url}
        onPress={() => onImagePress?.(url, 0)}
        style={[styles.single, { borderRadius: radius.card }]}
      />
    );
  }

  // ─── Grid (2+) ───────────────────────────────────────────────────────────────
  const tiles = resolved.slice(0, 4);
  return (
    <View style={[styles.grid, { borderRadius: radius.card }]}>
      {tiles.map((url, index) => {
        const original = mediaUrls[index]!;
        const isLast = index === 3 && resolved.length > 4;
        return (
          <View key={url} style={styles.gridTile}>
            {isVideoFile(original) ? (
              <VideoTile uri={url} />
            ) : (
              <ImageTile
                uri={url}
                onPress={() => onImagePress?.(url, index)}
                style={styles.fill}
              />
            )}
            {isLast && (
              <View style={[styles.moreOverlay, { backgroundColor: colors.background + 'cc' }]}>
                <AppText variant="title" weight="bold">
                  +{resolved.length - 4}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  single: { width: 220, height: 220, overflow: 'hidden' },
  video: { width: '100%', height: '100%' },
  fill: { width: '100%', height: '100%' },
  grid: {
    width: 220,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    overflow: 'hidden',
  },
  gridTile: { width: 109, height: 109, overflow: 'hidden' },
  moreOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 200,
    paddingVertical: 2,
  },
  voiceBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTrackWrap: { flex: 1 },
  voiceTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  voiceFill: { height: 4, borderRadius: 2 },
  voiceTime: { minWidth: 34, textAlign: 'right' },
});

export type { MediaMessageProps };
