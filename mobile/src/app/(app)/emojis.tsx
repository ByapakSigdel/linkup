import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  type GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
  Smile,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Upload,
  Pencil,
  Eraser,
  ImageIcon,
} from 'lucide-react-native';

import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useCustomEmojiStore } from '@/stores/custom-emoji-store';
import { useTheme } from '@/theme';
import {
  Screen,
  AppText,
  Muted,
  Button,
  Card,
  Input,
  Badge,
  Spinner,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useResponsive } from '@/hooks/use-responsive';

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface CustomEmoji {
  id: string;
  name: string;
  imageUrl: string;
  category?: string;
  isAnimated?: boolean;
  useCount: number;
  createdAt: string;
}

interface NewEmojiPayload {
  name: string;
  image: string;
  category?: string;
  isAnimated?: boolean;
}

function errMessage(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } }).response
      ?.data?.error?.message ?? fallback
  );
}

const DRAW_COLORS = [
  '#E8E4DC', '#C4A8E0', '#D4A574', '#A8BFD4',
  '#F06595', '#FF6B6B', '#FFD93D', '#51CF66',
  '#339AF0', '#845EF7', '#FF9500', '#1A1B2E',
];

const CANVAS_SIZE = 220;

/* ─── Drawn-path model ────────────────────────────────────────────────────── */
interface Stroke {
  d: string;
  color: string;
  width: number;
}

/* ─── Emoji Creator ───────────────────────────────────────────────────────── */
type CreateMode = 'upload' | 'draw';

function EmojiCreator({
  onCreate,
}: {
  onCreate: (payload: NewEmojiPayload) => Promise<void>;
}) {
  const { colors, radius } = useTheme();
  const [mode, setMode] = useState<CreateMode>('upload');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  // Upload state
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [uploadIsAnimated, setUploadIsAnimated] = useState(false);
  const [error, setError] = useState<string>();

  // Draw state
  const canvasViewRef = useRef<View>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [drawColor, setDrawColor] = useState('#C4A8E0');
  const [isErasing, setIsErasing] = useState(false);

  const sanitizedName = name.trim().replace(/[\s:]+/g, '_').toLowerCase();

  // ---- Upload handling ----
  const handlePick = useCallback(async () => {
    setError(undefined);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Allow photo access to pick an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        base64: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
        setError('Image must be under 2 MB.');
        return;
      }
      if (!asset.base64) {
        setError('Could not read that image.');
        return;
      }
      const mime = asset.mimeType ?? 'image/png';
      setUploadDataUrl(`data:${mime};base64,${asset.base64}`);
      setUploadIsAnimated(mime === 'image/gif');
    } catch {
      setError('Could not open the image picker.');
    }
  }, []);

  // ---- Canvas drawing ----
  const onTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      setCurrent({
        d: `M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`,
        color: isErasing ? '#0d0e1a' : drawColor,
        width: isErasing ? 24 : 12,
      });
    },
    [drawColor, isErasing],
  );

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    setCurrent((cur) =>
      cur
        ? { ...cur, d: `${cur.d} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}` }
        : cur,
    );
  }, []);

  const onTouchEnd = useCallback(() => {
    setCurrent((cur) => {
      if (cur) setStrokes((prev) => [...prev, cur]);
      return null;
    });
  }, []);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrent(null);
  }, []);

  // ---- Submit ----
  const resetForm = () => {
    setName('');
    setCategory('');
    setNameError(undefined);
    setUploadDataUrl(null);
    setUploadIsAnimated(false);
    setError(undefined);
    clearCanvas();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your emoji a name.');
      return;
    }
    if (trimmed.length > 50) {
      setNameError('Name must be 50 characters or fewer.');
      return;
    }
    setNameError(undefined);

    let image: string | null = null;
    let isAnimated = false;

    if (mode === 'upload') {
      if (!uploadDataUrl) {
        setError('Choose an image first.');
        return;
      }
      image = uploadDataUrl;
      isAnimated = uploadIsAnimated;
    } else {
      if (strokes.length === 0) {
        setError('Draw something first.');
        return;
      }
      try {
        image = await captureRef(canvasViewRef, {
          result: 'data-uri',
          format: 'png',
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
        });
      } catch {
        setError('Could not capture the drawing.');
        return;
      }
    }

    if (!image) return;

    setSubmitting(true);
    try {
      await onCreate({
        name: sanitizedName || trimmed,
        image,
        category: category.trim() || undefined,
        isAnimated,
      });
      resetForm();
    } catch {
      // surfaced via toast in parent
    } finally {
      setSubmitting(false);
    }
  };

  const allStrokes = current ? [...strokes, current] : strokes;

  return (
    <Card variant="bordered" style={{ borderRadius: radius.card }}>
      {/* Mode toggle */}
      <View
        style={[
          styles.toggle,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {(['upload', 'draw'] as const).map((m) => {
          const active = mode === m;
          const Icon = m === 'upload' ? Upload : Pencil;
          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.toggleBtn,
                active && { backgroundColor: colors.primary },
              ]}
            >
              <Icon
                size={16}
                color={active ? colors.textOnPrimary : colors.textMuted}
              />
              <AppText
                variant="label"
                color={active ? colors.textOnPrimary : colors.textMuted}
              >
                {m === 'upload' ? 'Upload' : 'Draw'}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {/* Creation surface */}
      <View style={{ alignItems: 'center', gap: 12 }}>
        {mode === 'upload' ? (
          <>
            <Pressable
              onPress={handlePick}
              style={[
                styles.dropzone,
                {
                  borderColor: uploadDataUrl ? colors.border : colors.borderStrong,
                  backgroundColor: colors.background,
                },
              ]}
            >
              {uploadDataUrl ? (
                <Image
                  source={{ uri: uploadDataUrl }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                />
              ) : (
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <ImageIcon size={32} color={colors.textMuted} />
                  <Muted variant="caption" center>
                    Tap to choose an image
                  </Muted>
                </View>
              )}
            </Pressable>
            {uploadDataUrl ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setUploadDataUrl(null);
                  setUploadIsAnimated(false);
                }}
                leftIcon={<Trash2 size={16} color={colors.text} />}
                label="Remove"
              />
            ) : null}
          </>
        ) : (
          <>
            <View
              ref={canvasViewRef}
              collapsable={false}
              style={[styles.canvas, { borderColor: colors.border }]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderGrant={onTouchStart}
              onResponderMove={onTouchMove}
              onResponderRelease={onTouchEnd}
            >
              <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
                {allStrokes.map((s, i) => (
                  <Path
                    key={i}
                    d={s.d}
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </Svg>
            </View>

            {/* Palette */}
            <View style={styles.palette}>
              {DRAW_COLORS.map((c) => {
                const active = drawColor === c && !isErasing;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setDrawColor(c);
                      setIsErasing(false);
                    }}
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: c,
                        borderColor: active ? colors.primary : 'transparent',
                        transform: [{ scale: active ? 1.15 : 1 }],
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Tools */}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setIsErasing((v) => !v)}
                style={[
                  styles.tool,
                  {
                    backgroundColor: isErasing ? colors.primary : colors.surfaceHover,
                  },
                ]}
              >
                <Eraser
                  size={16}
                  color={isErasing ? colors.textOnPrimary : colors.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={clearCanvas}
                style={[styles.tool, { backgroundColor: colors.surfaceHover }]}
              >
                <Trash2 size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </>
        )}

        {error ? (
          <AppText variant="caption" color={colors.error} center>
            {error}
          </AppText>
        ) : null}
      </View>

      {/* Details */}
      <View style={{ gap: 12, marginTop: 16 }}>
        <Input
          label="Name"
          placeholder="happy_cat"
          value={name}
          maxLength={50}
          error={nameError}
          onChangeText={setName}
          autoCapitalize="none"
        />
        <Muted variant="caption">
          {sanitizedName
            ? `Used as :${sanitizedName}:`
            : 'Letters, numbers and underscores'}
        </Muted>
        <Input
          label="Category (optional)"
          placeholder="reactions"
          value={category}
          maxLength={30}
          onChangeText={setCategory}
          autoCapitalize="none"
        />

        {mode === 'upload' && uploadIsAnimated ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color={colors.secondary} />
            <AppText variant="caption" color={colors.secondary}>
              Animated GIF detected
            </AppText>
          </View>
        ) : null}

        <Button
          variant="primary"
          onPress={handleSubmit}
          loading={submitting}
          leftIcon={<Sparkles size={16} color={colors.textOnPrimary} />}
          label="Create emoji"
          style={{ alignSelf: 'flex-start' }}
        />
      </View>
    </Card>
  );
}

/* ─── Emoji Card ──────────────────────────────────────────────────────────── */
function EmojiCard({
  emoji,
  onCopy,
  onDelete,
  deleting,
}: {
  emoji: CustomEmoji;
  onCopy: (emoji: CustomEmoji) => void;
  onDelete: (emoji: CustomEmoji) => void;
  deleting?: boolean;
}) {
  const { colors, radius } = useTheme();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleCopy = () => {
    onCopy(emoji);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const src = resolveMediaUrl(emoji.imageUrl);

  return (
    <Card variant="bordered" style={[styles.emojiCard, { borderRadius: radius.card }]}>
      {confirming ? (
        <View
          style={[
            styles.confirmOverlay,
            { backgroundColor: colors.background, borderRadius: radius.card },
          ]}
        >
          <AppText variant="caption" center>
            Delete :{emoji.name}:?
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              variant="destructive"
              size="sm"
              loading={deleting}
              onPress={() => onDelete(emoji)}
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
          style={styles.cardDelete}
        >
          <Trash2 size={14} color={colors.textMuted} />
        </Pressable>
      )}

      {emoji.isAnimated ? (
        <View style={styles.cardBadge}>
          <Badge label="GIF" variant="primary" />
        </View>
      ) : null}

      <View style={styles.emojiImageWrap}>
        {src ? (
          <Image
            source={{ uri: src }}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />
        ) : null}
      </View>

      <AppText variant="caption" weight="600" center numberOfLines={1}>
        :{emoji.name}:
      </AppText>
      <Muted variant="caption" center>
        used {emoji.useCount} {emoji.useCount === 1 ? 'time' : 'times'}
      </Muted>

      <Button
        variant={copied ? 'secondary' : 'outline'}
        size="sm"
        fullWidth
        onPress={handleCopy}
        leftIcon={
          copied ? (
            <Check size={14} color={colors.text} />
          ) : (
            <Copy size={14} color={colors.text} />
          )
        }
        label={copied ? 'Copied' : 'Copy'}
        style={{ marginTop: 8 }}
      />
    </Card>
  );
}

/* ─── Screen ──────────────────────────────────────────────────────────────── */
export default function EmojisScreen() {
  const { colors } = useTheme();
  const { gridColumns, contentMaxWidth } = useResponsive();
  // gridColumns is 3 on phones, then 4/5 on wider tablets — drives the emoji grid.
  const columns = gridColumns;
  const couple = useAuthStore((s) => s.couple);
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEmojis = useCallback(async () => {
    try {
      const res = await api.get('/creative/emojis');
      setEmojis(res.data.data.emojis ?? []);
    } catch (err) {
      useToastStore.getState().push({
        title: 'Something went wrong',
        body: errMessage(err, 'Could not load your emojis.'),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) {
      void loadEmojis();
    } else {
      setLoading(false);
    }
  }, [couple?.isPaired, loadEmojis]);

  const handleCreate = useCallback(async (payload: NewEmojiPayload) => {
    try {
      const res = await api.post('/creative/emojis', payload);
      const created: CustomEmoji = res.data.data.emoji;
      setEmojis((prev) => [created, ...prev]);
      // Make it usable in chat immediately.
      useCustomEmojiStore.getState().add({
        id: created.id,
        name: created.name,
        imageUrl: created.imageUrl,
        isAnimated: created.isAnimated,
      });
      useToastStore.getState().push({
        title: 'Emoji created',
        body: `:${created.name}: is ready to use`,
        icon: '✨',
        variant: 'success',
      });
    } catch (err) {
      useToastStore.getState().push({
        title: 'Create failed',
        body: errMessage(err, 'Could not create that emoji.'),
      });
      throw err;
    }
  }, []);

  const handleCopy = useCallback(async (emoji: CustomEmoji) => {
    const code = `:${emoji.name}:`;
    useToastStore.getState().push({
      title: 'Copied',
      body: `${code} is ready to paste`,
      icon: '📋',
    });
    // Optimistically bump local use count.
    setEmojis((prev) =>
      prev.map((e) =>
        e.id === emoji.id ? { ...e, useCount: e.useCount + 1 } : e,
      ),
    );
    try {
      const res = await api.post(`/creative/emojis/${emoji.id}/use`);
      const updated: CustomEmoji | undefined = res.data.data?.emoji;
      if (updated) {
        setEmojis((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e)),
        );
      }
    } catch {
      // Non-fatal: keep optimistic count.
    }
  }, []);

  const handleDelete = useCallback(async (emoji: CustomEmoji) => {
    setDeletingId(emoji.id);
    try {
      await api.delete(`/creative/emojis/${emoji.id}`);
      setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      useToastStore.getState().push({
        title: 'Emoji deleted',
        body: `:${emoji.name}: was removed`,
      });
    } catch (err) {
      useToastStore.getState().push({
        title: 'Delete failed',
        body: errMessage(err, 'Could not delete that emoji.'),
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

  // ---- Not paired ----
  if (!couple?.isPaired) {
    return (
      <Screen>
        <ScreenHeader title="Custom Emojis" />
        <EmptyState
          icon={<Smile size={40} color={colors.textMuted} />}
          title="Custom emojis"
          subtitle="Link up with your partner to build your own private collection of emojis you can use in chat."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader title="Custom Emojis" />
      </View>
      <FlatList
        data={loading ? [] : emojis}
        key={columns}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={[
          { padding: 16, gap: 10 },
          contentMaxWidth
            ? { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
            : null,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 16, marginBottom: 16 }}>
            <Muted variant="caption">
              Upload or draw your own emojis, then drop them into chat with :name:
            </Muted>
            <EmojiCreator onCreate={handleCreate} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppText variant="label">
                Your library
                {!loading && emojis.length > 0 ? ` (${emojis.length})` : ''}
              </AppText>
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} width={104} height={150} radius={16} />
              ))}
            </View>
          ) : (
            <Card variant="bordered" style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Smile size={28} color={colors.textMuted} />
              <AppText variant="label">No emojis yet</AppText>
              <Muted variant="caption" center style={{ maxWidth: 240 }}>
                Create your first one above — upload an image or draw something together.
              </Muted>
            </Card>
          )
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(Math.min(index, 8) * 40).springify()}
            style={{ flex: 1 / columns }}
          >
            <EmojiCard
              emoji={item}
              onCopy={handleCopy}
              onDelete={handleDelete}
              deleting={deletingId === item.id}
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
  dropzone: {
    width: 160,
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  canvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0d0e1a',
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    maxWidth: 220,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
  tool: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiCard: {
    alignItems: 'center',
    padding: 12,
    gap: 2,
  },
  emojiImageWrap: {
    height: 56,
    justifyContent: 'center',
    marginBottom: 4,
  },
  cardDelete: {
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 2,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 1,
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
