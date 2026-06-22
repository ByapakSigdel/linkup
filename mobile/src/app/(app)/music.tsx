import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import YoutubePlayer, { PLAYER_STATES } from 'react-native-youtube-iframe';
import {
  Headphones,
  Link2,
  ListMusic,
  Music,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  Input,
  Muted,
  Row,
  Screen,
  Skeleton,
  Spinner,
  Touchable,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useResponsive } from '@/hooks/use-responsive';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';

/* ─── Types (ported from web components/music/types.ts) ───────────────────── */

type TrackSource = 'youtube' | 'spotify' | 'url';

interface Track {
  id: string;
  title: string;
  artist?: string | null;
  album?: string | null;
  coverUrl?: string | null;
  source: TrackSource;
  sourceId?: string | null;
  url?: string | null;
  duration?: number | null;
  position?: number;
}

interface PlaylistSummary {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  trackCount: number;
}

interface PlaylistDetail {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
}

interface MusicState {
  trackId?: string;
  isPlaying: boolean;
  positionSec: number;
  track?: Track | null;
}

interface NewTrackInput {
  title: string;
  artist?: string;
  source: 'youtube' | 'url';
  sourceId?: string;
  url?: string;
}

/* ─── Helpers (ported from youtube.ts) ────────────────────────────────────── */

function extractYouTubeId(input: string): string | null {
  if (!input) return null;
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  const yt =
    value.match(/(?:youtu\.be\/)([A-Za-z0-9_-]{11})/) ??
    value.match(/[?&]v=([A-Za-z0-9_-]{11})/) ??
    value.match(/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
  if (yt && yt[1]) return yt[1];

  const match = value.match(/[A-Za-z0-9_-]{11}/);
  return match ? match[0] : null;
}

function youTubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim());
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function errMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message || fallback;
}

/* ─── Pulsing "listening together" dot ────────────────────────────────────── */

function PulseDot({ color }: { color: string }) {
  const v = useSharedValue(0.5);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View style={style}>
      <Radio color={color} size={13} />
    </Animated.View>
  );
}

/* ─── Player bar (ported from player-bar.tsx) ─────────────────────────────── */

function PlayerBar({
  track,
  isPlaying,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onAudioPlay,
  onAudioPause,
  onAudioEnded,
}: {
  track: Track;
  isPlaying: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onAudioPlay: () => void;
  onAudioPause: () => void;
  onAudioEnded: () => void;
}) {
  const { colors, radius } = useTheme();
  const isYouTube = track.source === 'youtube' && !!track.sourceId;
  const isAudio = track.source === 'url' && !!track.url;

  // expo-audio player for direct URL sources.
  const audioSrc = isAudio ? resolveMediaUrl(track.url) ?? null : null;
  const player = useAudioPlayer(audioSrc ? { uri: audioSrc } : null);
  const status = useAudioPlayerStatus(player);
  const lastFinished = useRef(false);

  // Autoplay the audio when the track changes / becomes available.
  useEffect(() => {
    if (!isAudio) return;
    lastFinished.current = false;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, isAudio]);

  // Mirror native audio play/pause/ended into parent state.
  useEffect(() => {
    if (!isAudio || !status.isLoaded) return;
    if (status.didJustFinish && !lastFinished.current) {
      lastFinished.current = true;
      onAudioEnded();
      return;
    }
    if (status.playing && !isPlaying) onAudioPlay();
    if (!status.playing && isPlaying && !status.didJustFinish) onAudioPause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.playing, status.didJustFinish, status.isLoaded]);

  // Keep audio playback in sync when parent toggles isPlaying (remote/control).
  useEffect(() => {
    if (!isAudio || !status.isLoaded) return;
    if (isPlaying && !status.playing) player.play();
    if (!isPlaying && status.playing) player.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, status.isLoaded]);

  const onYouTubeChange = useCallback(
    (state: string) => {
      if (state === PLAYER_STATES.ENDED) onAudioEnded();
      else if (state === PLAYER_STATES.PLAYING) onAudioPlay();
      else if (state === PLAYER_STATES.PAUSED) onAudioPause();
    },
    [onAudioEnded, onAudioPlay, onAudioPause],
  );

  const cover = resolveMediaUrl(track.coverUrl);

  return (
    <View
      style={[
        styles.playerBar,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.card,
        },
      ]}
    >
      {/* Media element */}
      {isYouTube && track.sourceId ? (
        <View style={[styles.ytWrap, { borderColor: colors.border }]}>
          <YoutubePlayer
            key={track.sourceId}
            height={190}
            play={isPlaying}
            videoId={track.sourceId}
            onChangeState={onYouTubeChange}
          />
        </View>
      ) : null}

      {/* Now-playing info + transport */}
      <Row style={{ marginTop: isYouTube ? 12 : 0 }}>
        <View
          style={[
            styles.coverBox,
            { backgroundColor: colors.primaryLight, borderRadius: radius.input },
          ]}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={styles.coverImg} />
          ) : (
            <Music2 color={colors.primary} size={22} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="subtitle" weight="bold" numberOfLines={1}>
            {track.title}
          </AppText>
          <Muted variant="caption" numberOfLines={1}>
            {track.artist || (isYouTube ? 'YouTube' : 'Audio')}
            {track.duration != null ? `  ·  ${formatDuration(track.duration)}` : ''}
          </Muted>
        </View>

        <Touchable
          onPress={onPrev}
          disabled={!hasPrev}
          hitSlop={8}
          style={{ opacity: hasPrev ? 1 : 0.35, padding: 6 }}
        >
          <SkipBack color={colors.text} size={20} />
        </Touchable>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isPlaying ? colors.success : colors.textMuted,
          }}
        />
        <Touchable
          onPress={onNext}
          disabled={!hasNext}
          hitSlop={8}
          style={{ opacity: hasNext ? 1 : 0.35, padding: 6 }}
        >
          <SkipForward color={colors.text} size={20} />
        </Touchable>
        <Touchable onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
          <X color={colors.textMuted} size={20} />
        </Touchable>
      </Row>
    </View>
  );
}

/* ─── Track row ───────────────────────────────────────────────────────────── */

function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  onPlay,
  onDelete,
}: {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.trackRow,
        {
          backgroundColor: isCurrent ? colors.primaryLight : 'transparent',
          borderRadius: radius.input,
        },
      ]}
    >
      <Touchable
        onPress={onPlay}
        style={{ ...styles.playBtn, backgroundColor: colors.surfaceActive }}
        accessibilityRole="button"
        accessibilityLabel={`Play ${track.title}`}
      >
        {isCurrent && isPlaying ? (
          <Pause color={colors.text} size={16} />
        ) : (
          <Play color={colors.text} size={16} />
        )}
      </Touchable>
      <AppText variant="caption" muted style={styles.trackIndex}>
        {index + 1}
      </AppText>
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText
          variant="body"
          weight="600"
          numberOfLines={1}
          color={isCurrent ? colors.primary : colors.text}
        >
          {track.title}
        </AppText>
        <Muted variant="caption" numberOfLines={1}>
          {track.artist || 'Unknown artist'}
        </Muted>
      </View>
      <View style={[styles.sourceBadge, { borderColor: colors.border }]}>
        {track.source === 'youtube' ? (
          <Music2 color={colors.textMuted} size={12} />
        ) : (
          <Link2 color={colors.textMuted} size={12} />
        )}
      </View>
      <Touchable
        onPress={onDelete}
        hitSlop={8}
        style={{ padding: 6 }}
        accessibilityLabel={`Remove ${track.title}`}
      >
        <Trash2 color={colors.textMuted} size={16} />
      </Touchable>
    </View>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────────────── */

export default function MusicScreen() {
  const { colors, radius } = useTheme();
  const { contentMaxWidth } = useResponsive();
  // Center the list + sticky player on tablets so they don't stretch edge-to-edge.
  const maxW = contentMaxWidth ?? undefined;
  const couple = useAuthStore((s) => s.couple);
  const pushToast = useToastStore((s) => s.push);

  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playlistDetail, setPlaylistDetail] = useState<PlaylistDetail | null>(
    null,
  );
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [adding, setAdding] = useState(false);

  // Player state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Listen-together
  const [listenTogether, setListenTogether] = useState(false);
  const [partnerActive, setPartnerActive] = useState(false);
  const listenTogetherRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const partnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create-playlist form
  const [showForm, setShowForm] = useState(false);
  const [plName, setPlName] = useState('');
  const [plDesc, setPlDesc] = useState('');

  // Add-track form
  const [link, setLink] = useState('');
  const [tTitle, setTTitle] = useState('');
  const [tArtist, setTArtist] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Playlist picker (mobile: dropdown via modal)
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    listenTogetherRef.current = listenTogether;
  }, [listenTogether]);

  // ---- Data loading ------------------------------------------------------

  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const { data } = await api.get('/music/playlists');
      const list: PlaylistSummary[] = data.data.playlists ?? [];
      setPlaylists(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      pushToast({
        title: 'Could not load playlists',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    } finally {
      setLoadingPlaylists(false);
    }
  }, [pushToast]);

  const fetchPlaylistDetail = useCallback(async (id: string) => {
    setLoadingTracks(true);
    try {
      const { data } = await api.get(`/music/playlists/${id}`);
      setPlaylistDetail(data.data.playlist ?? null);
      setTracks(data.data.tracks ?? []);
    } catch {
      setPlaylistDetail(null);
      setTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) fetchPlaylists();
  }, [couple?.isPaired, fetchPlaylists]);

  useEffect(() => {
    if (selectedId) fetchPlaylistDetail(selectedId);
    else {
      setPlaylistDetail(null);
      setTracks([]);
    }
  }, [selectedId, fetchPlaylistDetail]);

  // ---- Listen-together: relay + receive ---------------------------------

  const broadcastState = useCallback(
    (track: Track | null, playing: boolean, positionSec = 0) => {
      if (!listenTogetherRef.current) return;
      const payload: MusicState = {
        trackId: track?.id,
        isPlaying: playing,
        positionSec,
        track,
      };
      api.post('/music/listen/state', payload).catch(() => {});
      getSocket()?.emit('music:state', payload);
    },
    [],
  );

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onState = (state: MusicState) => {
      if (!listenTogetherRef.current) return;

      setPartnerActive(true);
      if (partnerTimerRef.current) clearTimeout(partnerTimerRef.current);
      partnerTimerRef.current = setTimeout(() => setPartnerActive(false), 30000);

      if (state.track) {
        applyingRemoteRef.current = true;
        setCurrentTrack(state.track);
        setIsPlaying(state.isPlaying);
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 0);
      } else {
        setIsPlaying(state.isPlaying);
      }
    };

    socket.on('music:state', onState);
    return () => {
      socket.off('music:state', onState);
      if (partnerTimerRef.current) clearTimeout(partnerTimerRef.current);
    };
  }, []);

  // ---- Actions -----------------------------------------------------------

  const handleCreatePlaylist = useCallback(async () => {
    const name = plName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post('/music/playlists', {
        name,
        description: plDesc.trim() || undefined,
      });
      const created = data.data.playlist;
      await fetchPlaylists();
      if (created?.id) setSelectedId(created.id);
      setPlName('');
      setPlDesc('');
      setShowForm(false);
      pushToast({ title: 'Playlist created', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Could not create playlist',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    } finally {
      setCreating(false);
    }
  }, [plName, plDesc, fetchPlaylists, pushToast]);

  const handleDeletePlaylist = useCallback(async () => {
    if (!selectedId) return;
    try {
      await api.delete(`/music/playlists/${selectedId}`);
      setSelectedId(null);
      await fetchPlaylists();
      pushToast({ title: 'Playlist deleted', variant: 'success' });
    } catch (err) {
      pushToast({
        title: 'Could not delete playlist',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    }
  }, [selectedId, fetchPlaylists, pushToast]);

  const handleAddTrack = useCallback(async () => {
    if (!selectedId) return;
    setAddError(null);
    const raw = link.trim();
    if (!raw) {
      setAddError('Paste a YouTube link or a direct audio URL.');
      return;
    }

    let input: NewTrackInput;
    const ytId = extractYouTubeId(raw);
    if (ytId) {
      input = {
        title: tTitle.trim() || 'YouTube track',
        artist: tArtist.trim() || undefined,
        source: 'youtube',
        sourceId: ytId,
        url: youTubeWatchUrl(ytId),
      };
    } else {
      if (!isHttpUrl(raw)) {
        setAddError('That does not look like a YouTube link or a valid audio URL.');
        return;
      }
      if (!tTitle.trim()) {
        setAddError('A title is required for direct audio URLs.');
        return;
      }
      input = {
        title: tTitle.trim(),
        artist: tArtist.trim() || undefined,
        source: 'url',
        url: raw,
      };
    }

    setAdding(true);
    try {
      await api.post(`/music/playlists/${selectedId}/tracks`, input);
      await fetchPlaylistDetail(selectedId);
      fetchPlaylists();
      setLink('');
      setTTitle('');
      setTArtist('');
    } catch (err) {
      pushToast({
        title: 'Could not add track',
        body: errMessage(err, 'Please try again.'),
        variant: 'info',
      });
    } finally {
      setAdding(false);
    }
  }, [selectedId, link, tTitle, tArtist, fetchPlaylistDetail, fetchPlaylists, pushToast]);

  const handleDeleteTrack = useCallback(
    async (trackId: string) => {
      if (!selectedId) return;
      try {
        await api.delete(`/music/playlists/${selectedId}/tracks/${trackId}`);
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        if (currentTrack?.id === trackId) {
          setCurrentTrack(null);
          setIsPlaying(false);
        }
        fetchPlaylists();
      } catch (err) {
        pushToast({
          title: 'Could not remove track',
          body: errMessage(err, 'Please try again.'),
          variant: 'info',
        });
      }
    },
    [selectedId, currentTrack?.id, fetchPlaylists, pushToast],
  );

  const playTrack = useCallback(
    (track: Track) => {
      setCurrentTrack(track);
      setIsPlaying(true);
      if (!applyingRemoteRef.current) broadcastState(track, true, 0);
    },
    [broadcastState],
  );

  const currentIndex = currentTrack
    ? tracks.findIndex((t) => t.id === currentTrack.id)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < tracks.length - 1;

  const playPrev = useCallback(() => {
    const prev = tracks[currentIndex - 1];
    if (hasPrev && prev) playTrack(prev);
  }, [hasPrev, currentIndex, tracks, playTrack]);

  const playNext = useCallback(() => {
    const next = tracks[currentIndex + 1];
    if (hasNext && next) playTrack(next);
  }, [hasNext, currentIndex, tracks, playTrack]);

  const toggleListenTogether = useCallback(() => {
    const next = !listenTogether;
    setListenTogether(next);
    if (next && currentTrack) {
      listenTogetherRef.current = true;
      broadcastState(currentTrack, isPlaying, 0);
    }
    if (!next) setPartnerActive(false);
  }, [listenTogether, currentTrack, isPlaying, broadcastState]);

  // ---- Not paired --------------------------------------------------------

  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Music" />
        <EmptyState
          icon={<Music color={colors.primary} size={48} />}
          title="Music together"
          subtitle="Link up with your partner to build shared playlists and listen along in real time."
        />
      </Screen>
    );
  }

  // ---- Page --------------------------------------------------------------

  const headerRight =
    listenTogether && partnerActive ? (
      <Row gap={6}>
        <PulseDot color={colors.success} />
        <AppText variant="caption" color={colors.success} weight="600">
          Together
        </AppText>
      </Row>
    ) : undefined;

  return (
    <Screen padded={false}>
      <View
        style={[
          { paddingHorizontal: 16 },
          maxW ? { maxWidth: maxW, width: '100%', alignSelf: 'center' } : null,
        ]}
      >
        <ScreenHeader title="Music" subtitle="Shared playlists" right={headerRight} />
      </View>

      <FlatList
        data={tracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[
          { padding: 16, paddingBottom: 24 },
          maxW ? { maxWidth: maxW, width: '100%', alignSelf: 'center' } : null,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 8 }}>
            {/* Listen together toggle */}
            <Button
              variant={listenTogether ? 'secondary' : 'outline'}
              size="sm"
              onPress={toggleListenTogether}
              leftIcon={
                <Headphones
                  color={listenTogether ? colors.text : colors.text}
                  size={16}
                />
              }
              label={listenTogether ? 'Listening together' : 'Listen together'}
            />

            {/* Playlist picker */}
            <Card padded={false}>
              <Touchable
                onPress={() => setPickerOpen(true)}
                style={styles.pickerRow}
              >
                <ListMusic color={colors.primary} size={18} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <AppText variant="subtitle" weight="bold" numberOfLines={1}>
                    {playlistDetail?.name ?? 'Select a playlist'}
                  </AppText>
                  <Muted variant="caption" numberOfLines={1}>
                    {playlistDetail?.description ||
                      `${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}`}
                  </Muted>
                </View>
                <AppText variant="caption" color={colors.primary} weight="600">
                  Change
                </AppText>
              </Touchable>

              {playlistDetail ? (
                <View
                  style={[styles.plActions, { borderTopColor: colors.border }]}
                >
                  <Touchable
                    onPress={handleDeletePlaylist}
                    hitSlop={6}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Trash2 color={colors.error} size={15} />
                    <AppText variant="caption" color={colors.error} weight="600">
                      Delete playlist
                    </AppText>
                  </Touchable>
                </View>
              ) : null}
            </Card>

            {/* Add track form (only when a playlist is selected) */}
            {playlistDetail ? (
              <Card style={{ gap: 10 }}>
                <Input
                  placeholder="Paste a YouTube link or direct audio URL"
                  value={link}
                  onChangeText={setLink}
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={addError ?? undefined}
                />
                <Input
                  placeholder="Title (optional for YouTube)"
                  value={tTitle}
                  onChangeText={setTTitle}
                  maxLength={120}
                />
                <Input
                  placeholder="Artist (optional)"
                  value={tArtist}
                  onChangeText={setTArtist}
                  maxLength={120}
                />
                <Button
                  size="sm"
                  loading={adding}
                  onPress={handleAddTrack}
                  leftIcon={<Plus color={colors.textOnPrimary} size={16} />}
                  label="Add track"
                />
              </Card>
            ) : null}

            {playlistDetail ? (
              <AppText variant="label" muted>
                Tracks
              </AppText>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            index={index}
            isCurrent={item.id === currentTrack?.id}
            isPlaying={isPlaying}
            onPlay={() => playTrack(item)}
            onDelete={() => handleDeleteTrack(item.id)}
          />
        )}
        ListEmptyComponent={
          loadingTracks ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={56} radius={radius.input} />
              ))}
            </View>
          ) : playlistDetail ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <Muted center>No tracks yet. Paste a song above to get started.</Muted>
            </View>
          ) : (
            <EmptyState
              icon={<Music2 color={colors.textMuted} size={36} />}
              title="Select a playlist"
              subtitle="Pick a playlist above, or create a new one to start adding songs."
            />
          )
        }
      />

      {/* Sticky player bar */}
      {currentTrack ? (
        <View
          style={[
            styles.playerWrap,
            maxW ? { left: 16, right: 16, alignItems: 'center' } : null,
          ]}
        >
         <View style={maxW ? { width: '100%', maxWidth: maxW } : undefined}>
          <PlayerBar
            track={currentTrack}
            isPlaying={isPlaying}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={playPrev}
            onNext={playNext}
            onClose={() => {
              setCurrentTrack(null);
              setIsPlaying(false);
              if (!applyingRemoteRef.current) broadcastState(null, false, 0);
            }}
            onAudioPlay={() => {
              setIsPlaying(true);
              if (!applyingRemoteRef.current) broadcastState(currentTrack, true, 0);
            }}
            onAudioPause={() => {
              setIsPlaying(false);
              if (!applyingRemoteRef.current)
                broadcastState(currentTrack, false, 0);
            }}
            onAudioEnded={playNext}
          />
          <Muted variant="caption" center style={{ marginTop: 6 }}>
            Best-effort sync: track selection and play/pause are shared.
          </Muted>
         </View>
        </View>
      ) : null}

      {/* Playlist picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <AppText variant="subtitle" weight="bold">
                Playlists
              </AppText>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => setShowForm((s) => !s)}
                leftIcon={<Plus color={colors.text} size={16} />}
                label="New"
              />
            </Row>

            {showForm ? (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <Input
                  placeholder="Playlist name"
                  value={plName}
                  onChangeText={setPlName}
                  maxLength={80}
                />
                <Input
                  placeholder="Description (optional)"
                  value={plDesc}
                  onChangeText={setPlDesc}
                  maxLength={200}
                />
                <Row style={{ justifyContent: 'flex-end' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => setShowForm(false)}
                    label="Cancel"
                  />
                  <Button
                    size="sm"
                    loading={creating}
                    disabled={!plName.trim()}
                    onPress={handleCreatePlaylist}
                    label="Create"
                  />
                </Row>
              </View>
            ) : null}

            {loadingPlaylists ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Spinner />
              </View>
            ) : playlists.length === 0 ? (
              <View style={{ paddingVertical: 24 }}>
                <Muted center>
                  No playlists yet. Create one to start curating songs together.
                </Muted>
              </View>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(p) => p.id}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => {
                  const isActive = item.id === selectedId;
                  const cover = resolveMediaUrl(item.coverUrl);
                  return (
                    <Touchable
                      onPress={() => {
                        setSelectedId(item.id);
                        setPickerOpen(false);
                      }}
                      style={{
                        ...styles.plItem,
                        backgroundColor: isActive ? colors.primary : 'transparent',
                        borderRadius: radius.input,
                      }}
                    >
                      <View
                        style={[
                          styles.plCover,
                          {
                            backgroundColor: isActive
                              ? 'rgba(255,255,255,0.18)'
                              : colors.primaryLight,
                          },
                        ]}
                      >
                        {cover ? (
                          <Image source={{ uri: cover }} style={styles.plCoverImg} />
                        ) : (
                          <Music2
                            color={isActive ? colors.textOnPrimary : colors.primary}
                            size={16}
                          />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <AppText
                          variant="body"
                          weight="600"
                          numberOfLines={1}
                          color={isActive ? colors.textOnPrimary : colors.text}
                        >
                          {item.name}
                        </AppText>
                        <AppText
                          variant="caption"
                          numberOfLines={1}
                          color={
                            isActive ? colors.textOnPrimary : colors.textMuted
                          }
                        >
                          {item.trackCount}{' '}
                          {item.trackCount === 1 ? 'track' : 'tracks'}
                        </AppText>
                      </View>
                    </Touchable>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  plActions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 4,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackIndex: {
    width: 18,
    textAlign: 'center',
  },
  sourceBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  playerBar: {
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  ytWrap: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: { width: 48, height: 48 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    paddingBottom: 32,
  },
  plItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 8,
    marginBottom: 2,
  },
  plCover: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plCoverImg: { width: 40, height: 40 },
});
