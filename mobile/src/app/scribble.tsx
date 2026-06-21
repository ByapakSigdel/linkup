import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Save, Send, Sparkles, ImageIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { connectSocket, getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';
import {
  Screen,
  AppText,
  Button,
  Card,
  Row,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { LinkupMark } from '@/components/brand-mark';
import {
  ScribbleCanvas,
  type ScribbleCanvasHandle,
  type RemoteScribbleStroke,
  type NormalizedPoint,
} from '@/components/creative';

interface ScribbleItem {
  id: string;
  imageUrl: string;
  createdAt: string;
}

export default function ScribbleScreen() {
  const { colors } = useTheme();
  const couple = useAuthStore((s) => s.couple);
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const pushToast = useToastStore((s) => s.push);

  const canvasRef = useRef<ScribbleCanvasHandle>(null);

  const [gallery, setGallery] = useState<ScribbleItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerDrawing, setPartnerDrawing] = useState(false);
  const [partnerCursor, setPartnerCursor] = useState<NormalizedPoint | null>(null);
  const partnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorThrottle = useRef(0);

  // ─── Gallery ────────────────────────────────────────────────────────────────

  const fetchGallery = useCallback(async () => {
    setLoadingGallery(true);
    try {
      const res = await api.get('/creative/scribbles');
      setGallery(res.data.data.scribbles ?? []);
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
    if (!couple?.isPaired || !token) return;
    const socket = getSocket() ?? connectSocket(token);

    const flagPartnerDrawing = () => {
      setPartnerDrawing(true);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      partnerTimer.current = setTimeout(() => setPartnerDrawing(false), 1200);
    };

    const onReceived = (payload: RemoteScribbleStroke & { userId?: string }) => {
      canvasRef.current?.applyRemoteStroke({
        id: payload.id,
        tool: payload.tool,
        color: payload.color,
        width: payload.width,
        opacity: payload.opacity,
        points: payload.points,
        done: payload.done,
      });
      flagPartnerDrawing();
    };

    const onCleared = () => canvasRef.current?.clearLocal();
    const onCursor = (payload: { x: number; y: number }) =>
      setPartnerCursor({ x: payload.x, y: payload.y });

    const onSyncRequest = async () => {
      if (!canvasRef.current?.hasContent()) return;
      const image = await canvasRef.current?.toDataURL();
      if (image) socket.emit('scribble:sync', { image });
    };

    const onSync = (payload: { image?: string }) => {
      if (payload.image) canvasRef.current?.loadImage(payload.image);
    };

    socket.on('scribble:received', onReceived);
    socket.on('scribble:cleared', onCleared);
    socket.on('scribble:cursor', onCursor);
    socket.on('scribble:sync:request', onSyncRequest);
    socket.on('scribble:sync', onSync);

    socket.emit('scribble:sync:request');

    return () => {
      socket.off('scribble:received', onReceived);
      socket.off('scribble:cleared', onCleared);
      socket.off('scribble:cursor', onCursor);
      socket.off('scribble:sync:request', onSyncRequest);
      socket.off('scribble:sync', onSync);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
    };
  }, [couple?.isPaired, token]);

  const handleLocalStroke = useCallback((stroke: RemoteScribbleStroke) => {
    getSocket()?.emit('scribble:stroke', stroke);
  }, []);

  const handleClear = useCallback(() => {
    getSocket()?.emit('scribble:clear');
  }, []);

  const handleCursorMove = useCallback((point: NormalizedPoint) => {
    const now = Date.now();
    const hiding = point.x < 0;
    if (!hiding && now - cursorThrottle.current < 33) return;
    cursorThrottle.current = now;
    getSocket()?.emit('scribble:cursor', point);
  }, []);

  // ─── Save / Send ─────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (sendAsMessage: boolean) => {
      const image = await canvasRef.current?.toDataURL();
      if (!image) return;
      if (sendAsMessage) setSending(true);
      else setSaving(true);
      try {
        const res = await api.post('/creative/scribbles', {
          image,
          backgroundColor: canvasRef.current?.getBackgroundColor(),
          sendAsMessage,
        });
        const scribble = res.data.data.scribble as ScribbleItem | undefined;
        if (scribble) setGallery((prev) => [scribble, ...prev]);

        if (sendAsMessage) {
          pushToast({ title: 'Sent to chat!', variant: 'success' });
          router.push('/(tabs)/chat');
        } else {
          pushToast({ title: 'Scribble saved', variant: 'success' });
        }
      } catch (err) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } }).response
            ?.data?.error?.message ?? 'Something went wrong';
        pushToast({ title: 'Could not save', body: msg, variant: 'info' });
      } finally {
        setSending(false);
        setSaving(false);
      }
    },
    [pushToast],
  );

  // ─── Empty (unpaired) ────────────────────────────────────────────────────────

  if (!couple?.isPaired) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Scribble" />
        <EmptyState
          icon={<LinkupMark size={56} />}
          title="Scribble together"
          subtitle="Link up with your partner to doodle on a shared canvas in real time and send little drawings straight to your chat."
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
        title="Scribble"
        subtitle="Draw together live"
        right={
          partnerDrawing ? (
            <Animated.View entering={FadeIn} style={styles.partnerPill}>
              <Sparkles color={colors.accent} size={12} />
              <AppText variant="caption" color={colors.accent} weight="700">
                Drawing…
              </AppText>
            </Animated.View>
          ) : null
        }
      />

      <View style={{ gap: 14, paddingTop: 12 }}>
        <Row gap={8}>
          <Button
            variant="outline"
            size="sm"
            label="Save"
            loading={saving}
            disabled={sending}
            leftIcon={<Save color={colors.text} size={16} />}
            onPress={() => persist(false)}
            style={{ flex: 1 }}
          />
          <Button
            size="sm"
            label="Send to chat"
            loading={sending}
            disabled={saving}
            leftIcon={<Send color={colors.textOnPrimary} size={16} />}
            onPress={() => persist(true)}
            style={{ flex: 1 }}
          />
        </Row>

        <ScribbleCanvas
          ref={canvasRef}
          height={380}
          onLocalStroke={handleLocalStroke}
          onClear={handleClear}
          onCursorMove={handleCursorMove}
          partnerCursor={partnerCursor}
        />

        {/* Gallery */}
        <Row gap={6} style={{ marginTop: 6 }}>
          <ImageIcon color={colors.textMuted} size={16} />
          <AppText variant="subtitle">Your scribbles</AppText>
        </Row>

        {loadingGallery ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={96} radius={12} style={styles.cell} />
            ))}
          </View>
        ) : gallery.length === 0 ? (
          <Card variant="bordered" style={{ alignItems: 'center', paddingVertical: 28 }}>
            <AppText muted center>No saved scribbles yet. Draw something and hit Save.</AppText>
          </Card>
        ) : (
          <View style={styles.grid}>
            {gallery.map((item, i) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(i * 40)}
                style={[styles.cell, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Image
                  source={{ uri: resolveMediaUrl(item.imageUrl) }}
                  style={styles.thumb}
                  resizeMode="contain"
                />
              </Animated.View>
            ))}
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
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
});
