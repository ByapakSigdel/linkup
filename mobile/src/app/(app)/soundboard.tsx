import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  Music,
  Mic,
  Upload,
  Square,
  Play,
  Pause,
  Trash2,
  Plus,
  Volume2,
  Loader,
  AlertCircle,
} from 'lucide-react-native';

import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useTheme } from '@/theme';
import {
  Screen,
  AppText,
  Muted,
  Button,
  Card,
  Input,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useResponsive } from '@/hooks/use-responsive';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface BoardSound {
  id: string;
  name: string;
  audioUrl: string;
  emoji?: string;
  category?: string;
  color?: string;
  duration?: number;
  useCount: number;
}

interface NewSoundPayload {
  name: string;
  audio: string;
  emoji?: string;
  category?: string;
  color?: string;
  duration?: number;
}

const MAX_RECORD_SECONDS = 10;
const DEFAULT_COLOR = '#C4A8E0';

const SWATCHES = [
  '#C4A8E0', '#D4A574', '#A8BFD4', '#F06595',
  '#FF6B6B', '#51CF66', '#339AF0', '#FFD93D',
];

function errMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } }).response
      ?.data?.error?.message ?? fallback
  );
}

function formatTime(s: number) {
  return `0:${String(Math.floor(s)).padStart(2, '0')}`;
}

/** Read a local file URI into a base64 data URL. */
async function uriToDataUrl(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* ─── Sound Creator ───────────────────────────────────────────────────────── */
type AddMode = 'record' | 'upload';

function SoundCreator({
  onCreate,
}: {
  onCreate: (payload: NewSoundPayload) => Promise<void>;
}) {
  const { colors, radius } = useTheme();
  const [mode, setMode] = useState<AddMode>('record');

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [nameError, setNameError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string>();

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const previewRef = useRef<AudioPlayer | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(async () => {
    stopTimer();
    setIsRecording(false);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) {
        const url = await uriToDataUrl(uri);
        setAudioDataUrl(url);
      }
    } catch {
      setError('Could not process the recording.');
    }
  }, [recorder, stopTimer]);

  const startRecording = useCallback(async () => {
    setError(undefined);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone access was denied.');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setElapsed(0);
      setAudioDataUrl(null);
      setDuration(undefined);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 0.1;
          if (next >= MAX_RECORD_SECONDS) {
            void stopRecording();
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 100);
    } catch {
      setError('Recording is not available. Try uploading instead.');
    }
  }, [recorder, stopRecording]);

  // Capture recorded duration once recording ends.
  useEffect(() => {
    if (!isRecording && elapsed > 0 && audioDataUrl) {
      setDuration(Math.round(elapsed * 10) / 10);
    }
  }, [isRecording, elapsed, audioDataUrl]);

  const handlePick = useCallback(async () => {
    setError(undefined);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.mimeType && !asset.mimeType.startsWith('audio/')) {
        setError('Please choose an audio file.');
        return;
      }
      if (asset.size && asset.size > 5 * 1024 * 1024) {
        setError('Audio must be under 5 MB.');
        return;
      }
      const url = await uriToDataUrl(asset.uri);
      setAudioDataUrl(url);
    } catch {
      setError('Could not read that file.');
    }
  }, []);

  const togglePreview = useCallback(() => {
    if (!audioDataUrl) return;
    if (previewPlaying) {
      previewRef.current?.pause();
      setPreviewPlaying(false);
      return;
    }
    try {
      previewRef.current?.release();
      const player = createAudioPlayer(audioDataUrl);
      previewRef.current = player;
      player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) setPreviewPlaying(false);
      });
      player.play();
      setPreviewPlaying(true);
    } catch {
      setPreviewPlaying(false);
    }
  }, [audioDataUrl, previewPlaying]);

  const clearAudio = useCallback(() => {
    previewRef.current?.pause();
    setPreviewPlaying(false);
    setAudioDataUrl(null);
    setDuration(undefined);
    setElapsed(0);
  }, []);

  const switchMode = (next: AddMode) => {
    if (isRecording) void stopRecording();
    clearAudio();
    setError(undefined);
    setMode(next);
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopTimer();
      previewRef.current?.release();
    };
  }, [stopTimer]);

  const resetForm = () => {
    setName('');
    setEmoji('');
    setColor(DEFAULT_COLOR);
    setNameError(undefined);
    clearAudio();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your sound a name.');
      return;
    }
    if (trimmed.length > 50) {
      setNameError('Name must be 50 characters or fewer.');
      return;
    }
    if (!audioDataUrl) {
      setError(mode === 'record' ? 'Record something first.' : 'Choose an audio file first.');
      return;
    }
    setNameError(undefined);
    setSubmitting(true);
    try {
      await onCreate({
        name: trimmed,
        audio: audioDataUrl,
        emoji: emoji.trim() || undefined,
        color,
        duration,
      });
      resetForm();
    } catch {
      // surfaced via toast in parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="bordered" style={{ borderRadius: radius.card }}>
      {/* Mode toggle */}
      <View
        style={[
          styles.toggle,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {(['record', 'upload'] as const).map((m) => {
          const active = mode === m;
          const Icon = m === 'record' ? Mic : Upload;
          return (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.toggleBtn, active && { backgroundColor: colors.primary }]}
            >
              <Icon size={16} color={active ? colors.textOnPrimary : colors.textMuted} />
              <AppText
                variant="label"
                color={active ? colors.textOnPrimary : colors.textMuted}
              >
                {m === 'record' ? 'Record' : 'Upload'}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Capture surface */}
      <View
        style={[
          styles.capture,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {mode === 'record' ? (
          <>
            <Pressable
              onPress={isRecording ? () => void stopRecording() : () => void startRecording()}
              style={[
                styles.recordBtn,
                { backgroundColor: isRecording ? colors.error : colors.primary },
              ]}
            >
              {isRecording ? (
                <Square size={26} color="#fff" fill="#fff" />
              ) : (
                <Mic size={30} color={colors.textOnPrimary} />
              )}
            </Pressable>
            {isRecording ? (
              <AppText variant="caption" color={colors.error}>
                {formatTime(elapsed)} / {formatTime(MAX_RECORD_SECONDS)}
              </AppText>
            ) : (
              <Muted variant="caption" center>
                {audioDataUrl
                  ? 'Recorded — preview below'
                  : `Tap to record (up to ${MAX_RECORD_SECONDS}s)`}
              </Muted>
            )}
          </>
        ) : (
          <>
            <Pressable
              onPress={handlePick}
              style={[styles.recordBtn, { backgroundColor: colors.surfaceHover }]}
            >
              <Upload size={30} color={colors.textMuted} />
            </Pressable>
            <Muted variant="caption" center>
              {audioDataUrl ? 'Loaded — preview below' : 'Tap to choose an audio file'}
            </Muted>
          </>
        )}

        {audioDataUrl ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              onPress={togglePreview}
              leftIcon={
                previewPlaying ? (
                  <Pause size={14} color={colors.text} />
                ) : (
                  <Play size={14} color={colors.text} />
                )
              }
              label={previewPlaying ? 'Pause' : 'Preview'}
            />
            {duration !== undefined ? (
              <Muted variant="caption">{duration}s</Muted>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onPress={clearAudio}
              leftIcon={<Trash2 size={14} color={colors.text} />}
            />
          </View>
        ) : null}

        {error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <AlertCircle size={14} color={colors.error} />
            <AppText variant="caption" color={colors.error} center>
              {error}
            </AppText>
          </View>
        ) : null}
      </View>

      {/* Details */}
      <View style={{ gap: 12, marginTop: 16 }}>
        <Input
          label="Name"
          placeholder="Air horn"
          value={name}
          maxLength={50}
          error={nameError}
          onChangeText={setName}
        />
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Emoji (optional)"
              placeholder="📣"
              value={emoji}
              maxLength={4}
              onChangeText={setEmoji}
            />
          </View>
          <View
            style={[
              styles.emojiPreview,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
          >
            <AppText style={{ fontSize: 24 }}>{emoji.trim() || '🔊'}</AppText>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label">Color</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {SWATCHES.map((c) => {
              const active = color === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: c,
                      borderColor: active ? colors.text : 'transparent',
                      transform: [{ scale: active ? 1.15 : 1 }],
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <Button
          variant="primary"
          onPress={handleSubmit}
          loading={submitting}
          leftIcon={<Plus size={16} color={colors.textOnPrimary} />}
          label="Add sound"
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    </Card>
  );
}

/* ─── Sound Pad ───────────────────────────────────────────────────────────── */
function SoundPad({
  sound,
  onPlay,
  onDelete,
  playing,
  deleting,
  columns,
}: {
  sound: BoardSound;
  onPlay: (sound: BoardSound) => void;
  onDelete: (sound: BoardSound) => void;
  playing?: boolean;
  deleting?: boolean;
  columns: number;
}) {
  const { colors, radius } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const color = sound.color || DEFAULT_COLOR;

  return (
    <View style={{ flex: 1 / columns }}>
      <Pressable
        onPress={() => onPlay(sound)}
        style={({ pressed }) => [
          styles.pad,
          {
            backgroundColor: `${color}22`,
            borderColor: playing ? color : `${color}55`,
            borderWidth: playing ? 2.5 : 2,
            borderRadius: radius.card,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <AppText style={{ fontSize: 36 }}>{sound.emoji || '🔊'}</AppText>
        <AppText variant="caption" weight="600" center numberOfLines={2}>
          {sound.name}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {playing ? (
            <>
              <Loader size={12} color={colors.textMuted} />
              <Muted variant="caption">playing</Muted>
            </>
          ) : (
            <>
              <Volume2 size={12} color={colors.textMuted} />
              <Muted variant="caption">{sound.useCount}</Muted>
            </>
          )}
        </View>
      </Pressable>

      {confirming ? (
        <View
          style={[
            styles.confirmOverlay,
            { backgroundColor: colors.background, borderRadius: radius.card },
          ]}
        >
          <AppText variant="caption" center>
            Delete this sound?
          </AppText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Button
              variant="destructive"
              size="sm"
              loading={deleting}
              onPress={() => onDelete(sound)}
              label="Delete"
            />
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setConfirming(false)}
              label="Cancel"
            />
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setConfirming(true)}
          hitSlop={8}
          style={[styles.padDelete, { backgroundColor: `${colors.background}b3` }]}
        >
          <Trash2 size={14} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────────────── */
export default function SoundboardScreen() {
  const { colors } = useTheme();
  const { gridColumns } = useResponsive();
  // Sound pads: 3 on phones → more columns on wide screens.
  const columns = gridColumns;
  const couple = useAuthStore((s) => s.couple);
  const [sounds, setSounds] = useState<BoardSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const loadSounds = useCallback(async () => {
    try {
      const res = await api.get('/creative/soundboard');
      setSounds(res.data.data.sounds ?? []);
    } catch (err) {
      useToastStore.getState().push({
        title: 'Something went wrong',
        body: errMessage(err, 'Could not load your soundboard.'),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) {
      void loadSounds();
    } else {
      setLoading(false);
    }
  }, [couple?.isPaired, loadSounds]);

  // Stop any playing audio on unmount.
  useEffect(() => {
    return () => {
      playerRef.current?.release();
    };
  }, []);

  const handleCreate = useCallback(async (payload: NewSoundPayload) => {
    try {
      const res = await api.post('/creative/soundboard', payload);
      const created: BoardSound = res.data.data.sound;
      setSounds((prev) => [created, ...prev]);
      useToastStore.getState().push({
        title: 'Sound added',
        body: `${created.emoji ? created.emoji + ' ' : ''}${created.name} is on your board`,
        icon: '🎵',
        variant: 'success',
      });
    } catch (err) {
      useToastStore.getState().push({
        title: 'Add failed',
        body: errMessage(err, 'Could not add that sound.'),
      });
      throw err;
    }
  }, []);

  const handlePlay = useCallback(async (sound: BoardSound) => {
    // Play locally.
    try {
      playerRef.current?.release();
      const src = resolveMediaUrl(sound.audioUrl);
      if (src) {
        const player = createAudioPlayer(src);
        player.volume = 0.9;
        playerRef.current = player;
        setPlayingId(sound.id);
        player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            setPlayingId((cur) => (cur === sound.id ? null : cur));
          }
        });
        player.play();
      }
    } catch {
      setPlayingId((cur) => (cur === sound.id ? null : cur));
    }

    // Optimistic use count bump.
    setSounds((prev) =>
      prev.map((s) =>
        s.id === sound.id ? { ...s, useCount: s.useCount + 1 } : s,
      ),
    );

    useToastStore.getState().push({
      title: `Played ${sound.name} for your partner`,
      icon: sound.emoji || '🔊',
    });

    // Relay to partner (server emits soundboard:play to the partner).
    try {
      await api.post(`/creative/soundboard/${sound.id}/play`);
    } catch {
      // Non-fatal: it already played locally.
    }
  }, []);

  const handleDelete = useCallback(async (sound: BoardSound) => {
    setDeletingId(sound.id);
    try {
      await api.delete(`/creative/soundboard/${sound.id}`);
      setSounds((prev) => prev.filter((s) => s.id !== sound.id));
      useToastStore.getState().push({
        title: 'Sound deleted',
        body: `${sound.name} was removed`,
      });
    } catch (err) {
      useToastStore.getState().push({
        title: 'Delete failed',
        body: errMessage(err, 'Could not delete that sound.'),
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ---- Not paired ----
  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="SoundBoard" />
        <EmptyState
          icon={<Music size={40} color={colors.textMuted} />}
          title="SoundBoard"
          subtitle="Link up with your partner to build a shared soundboard — tap a pad and they hear it too."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="SoundBoard" />
      </View>
      <FlatList
        data={loading ? [] : sounds}
        key={`pads-${columns}`}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 16, maxWidth: 760, width: '100%' }}>
            <Muted variant="caption">
              Record or upload sounds, then tap a pad to play it on both your devices.
            </Muted>
            <SoundCreator onCreate={handleCreate} />
            <AppText variant="label">
              Your pads
              {!loading && sounds.length > 0 ? ` (${sounds.length})` : ''}
            </AppText>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} width={104} height={104} radius={16} />
              ))}
            </View>
          ) : (
            <Card variant="bordered" style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Music size={28} color={colors.textMuted} />
              <AppText variant="label">No sounds yet</AppText>
              <Muted variant="caption" center style={{ maxWidth: 240 }}>
                Add your first sound above — record a quick clip or upload a file.
              </Muted>
            </Card>
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 8) * 40).springify()}
            style={{ flex: 1 / columns }}
          >
            <SoundPad
              sound={item}
              onPlay={handlePlay}
              onDelete={handleDelete}
              playing={playingId === item.id}
              deleting={deletingId === item.id}
              columns={columns}
            />
          </Animated.View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  capture: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
  },
  recordBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
  },
  pad: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
  },
  padDelete: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 8,
  },
});
