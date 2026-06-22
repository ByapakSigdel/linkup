import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Save, Plus, Trash2, Sparkles, Palette } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';
import {
  Screen,
  AppText,
  Button,
  Card,
  Input,
  Row,
  Spinner,
  EmptyState,
  Skeleton,
  Touchable,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { LinkupMark } from '@/components/brand-mark';
import {
  PaintCanvas,
  type PaintCanvasHandle,
  type RemotePaintStroke,
  type NormalizedPoint,
} from '@/components/creative';

interface PaintingSummary {
  id: string;
  title: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  createdAt: string;
}

const CANVAS_W = 1280;
const CANVAS_H = 800;

function errMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
      ?.message ?? 'Something went wrong'
  );
}

export default function PaintScreen() {
  const { colors } = useTheme();
  const couple = useAuthStore((s) => s.couple);
  const pushToast = useToastStore((s) => s.push);

  const canvasRef = useRef<PaintCanvasHandle>(null);

  const [paintingId, setPaintingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [gallery, setGallery] = useState<PaintingSummary[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [partnerActive, setPartnerActive] = useState(false);
  const [partnerCursor, setPartnerCursor] = useState<NormalizedPoint | null>(null);
  const partnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottle = useRef(0);

  // ─── Gallery ────────────────────────────────────────────────────────────────

  const fetchGallery = useCallback(async () => {
    setLoadingGallery(true);
    try {
      const res = await api.get('/creative/paintings');
      setGallery(res.data.data.paintings ?? []);
    } catch {
      setGallery([]);
    } finally {
      setLoadingGallery(false);
    }
  }, []);

  useEffect(() => {
    if (couple?.isPaired) fetchGallery();
  }, [couple?.isPaired, fetchGallery]);

  // ─── Realtime collaboration ──────────────────────────────────────────────────

  useEffect(() => {
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const flagActive = () => {
      setPartnerActive(true);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      partnerTimer.current = setTimeout(() => setPartnerActive(false), 1500);
    };

    const onStroke = (payload: RemotePaintStroke & { userId?: string }) => {
      canvasRef.current?.applyRemoteStroke({
        points: payload.points,
        color: payload.color,
        width: payload.width,
        tool: payload.tool,
        opacity: payload.opacity,
      });
      flagActive();
    };

    const onCleared = () => canvasRef.current?.clearLocal();
    const onCursor = (payload: { x: number; y: number; userId?: string }) =>
      setPartnerCursor({ x: payload.x, y: payload.y });

    socket.on('painting:stroke:added', onStroke);
    socket.on('painting:cleared', onCleared);
    socket.on('painting:cursor', onCursor);

    return () => {
      socket.off('painting:stroke:added', onStroke);
      socket.off('painting:cleared', onCleared);
      socket.off('painting:cursor', onCursor);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
    };
  }, [couple?.isPaired]);

  const handleLocalStroke = useCallback((stroke: RemotePaintStroke) => {
    getSocket()?.emit('painting:stroke', stroke);
  }, []);

  const handleClear = useCallback(() => {
    getSocket()?.emit('painting:clear');
  }, []);

  const handleCursorMove = useCallback((point: NormalizedPoint) => {
    const now = Date.now();
    if (now - cursorThrottle.current < 40) return;
    cursorThrottle.current = now;
    getSocket()?.emit('painting:cursor', point);
  }, []);

  // ─── New canvas / Save / Open / Delete ────────────────────────────────────────

  const newCanvas = useCallback(async () => {
    setCreating(true);
    try {
      const res = await api.post('/creative/paintings', {
        title: title || 'Untitled',
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: canvasRef.current?.getBackgroundColor() ?? '#FFFFFF',
      });
      const painting = res.data.data.painting as PaintingSummary | undefined;
      const newId = painting?.id ?? res.data.data.sessionId ?? null;
      setPaintingId(newId ?? null);
      canvasRef.current?.clearLocal();
      pushToast({ title: 'New canvas ready', variant: 'success' });
    } catch (err) {
      pushToast({ title: 'Could not create canvas', body: errMessage(err), variant: 'info' });
    } finally {
      setCreating(false);
    }
  }, [title, pushToast]);

  const save = useCallback(async () => {
    const imageUrl = await canvasRef.current?.toDataURL();
    const thumbnailUrl = await canvasRef.current?.toThumbnailDataURL(320);
    if (!imageUrl) return;
    setSaving(true);
    try {
      let id = paintingId;
      if (!id) {
        const res = await api.post('/creative/paintings', {
          title: title || 'Untitled',
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: canvasRef.current?.getBackgroundColor() ?? '#FFFFFF',
        });
        id = (res.data.data.painting?.id ?? res.data.data.sessionId) as string | null;
        setPaintingId(id ?? null);
      }
      if (!id) throw new Error('No painting id');

      const res = await api.patch(`/creative/paintings/${id}`, {
        imageUrl,
        thumbnailUrl,
        title: title || 'Untitled',
        status: 'saved',
      });
      const saved = res.data.data.painting as PaintingSummary | undefined;
      const fid = id;

      setGallery((prev) => {
        const next: PaintingSummary = saved ?? {
          id: fid,
          title: title || 'Untitled',
          thumbnailUrl: thumbnailUrl ?? undefined,
          imageUrl,
          createdAt: new Date().toISOString(),
        };
        const without = prev.filter((p) => p.id !== fid);
        return [next, ...without];
      });
      pushToast({ title: 'Painting saved', variant: 'success' });
    } catch (err) {
      pushToast({ title: 'Could not save', body: errMessage(err), variant: 'info' });
    } finally {
      setSaving(false);
    }
  }, [paintingId, title, pushToast]);

  const open = useCallback(
    async (id: string) => {
      setOpeningId(id);
      try {
        const res = await api.get(`/creative/paintings/${id}`);
        const painting = res.data.data.painting;
        setPaintingId(id);
        setTitle(painting?.title ?? '');
        if (painting?.imageUrl) {
          const uri = resolveMediaUrl(painting.imageUrl);
          if (uri) canvasRef.current?.loadImage(uri);
        }
      } catch (err) {
        pushToast({ title: 'Could not open painting', body: errMessage(err), variant: 'info' });
      } finally {
        setOpeningId(null);
      }
    },
    [pushToast],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/creative/paintings/${id}`);
        setGallery((prev) => prev.filter((p) => p.id !== id));
        if (paintingId === id) setPaintingId(null);
        pushToast({ title: 'Painting deleted', variant: 'info' });
      } catch (err) {
        pushToast({ title: 'Could not delete', body: errMessage(err), variant: 'info' });
      }
    },
    [paintingId, pushToast],
  );

  // ─── Empty (unpaired) ────────────────────────────────────────────────────────

  if (!couple?.isPaired) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Paint" />
        <EmptyState
          icon={<LinkupMark size={56} />}
          title="Paint together"
          subtitle="Link up with your partner to create art together on a shared canvas, with live brushes and a roaming partner cursor."
          action={
            <Button
              variant="outline"
              size="sm"
              label="Link your partner"
              onPress={() => router.push('/settings')}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} scroll>
      <ScreenHeader
        title="Paint"
        subtitle="A shared studio"
        right={
          partnerActive ? (
            <Animated.View entering={FadeIn} style={styles.partnerPill}>
              <Sparkles color={colors.accent} size={12} />
              <AppText variant="caption" color={colors.accent} weight="700">
                Painting…
              </AppText>
            </Animated.View>
          ) : null
        }
      />

      <View style={{ gap: 14, paddingTop: 12 }}>
        <Input
          value={title}
          onChangeText={setTitle}
          placeholder="Untitled painting…"
        />
        <Row gap={8}>
          <Button
            variant="outline"
            size="sm"
            label="New canvas"
            loading={creating}
            leftIcon={<Plus color={colors.text} size={16} />}
            onPress={newCanvas}
            style={{ flex: 1 }}
          />
          <Button
            size="sm"
            label="Save"
            loading={saving}
            leftIcon={<Save color={colors.textOnPrimary} size={16} />}
            onPress={save}
            style={{ flex: 1 }}
          />
        </Row>

        <PaintCanvas
          ref={canvasRef}
          height={380}
          onLocalStroke={handleLocalStroke}
          onClear={handleClear}
          onCursorMove={handleCursorMove}
          partnerCursor={partnerCursor}
        />

        <AppText variant="subtitle" style={{ marginTop: 6 }}>Saved paintings</AppText>

        {loadingGallery ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={96} radius={12} style={styles.cell} />
            ))}
          </View>
        ) : gallery.length === 0 ? (
          <Card variant="bordered" style={{ alignItems: 'center', paddingVertical: 28 }}>
            <AppText muted center>No paintings yet. Create something and hit Save.</AppText>
          </Card>
        ) : (
          <View style={styles.grid}>
            {gallery.map((p, i) => {
              const thumb = resolveMediaUrl(p.thumbnailUrl || p.imageUrl);
              const selected = paintingId === p.id;
              return (
                <Animated.View
                  key={p.id}
                  entering={FadeInDown.delay(i * 40)}
                  style={[
                    styles.cell,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 2 : 1,
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Touchable onPress={() => open(p.id)} disabled={openingId === p.id}>
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: colors.background }]}>
                        <Palette color={colors.textMuted} size={22} />
                      </View>
                    )}
                    {openingId === p.id ? (
                      <View style={styles.thumbOverlay}>
                        <Spinner size="small" color={colors.textInverse} />
                      </View>
                    ) : null}
                    <Row gap={4} style={{ padding: 8, justifyContent: 'space-between' }}>
                      <AppText variant="caption" weight="600" numberOfLines={1} style={{ flex: 1 }}>
                        {p.title || 'Untitled'}
                      </AppText>
                      <Touchable
                        onPress={() => remove(p.id)}
                        hitSlop={8}
                        accessibilityLabel="Delete painting"
                      >
                        <Trash2 color={colors.error} size={15} />
                      </Touchable>
                    </Row>
                  </Touchable>
                </Animated.View>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  partnerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 10,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
