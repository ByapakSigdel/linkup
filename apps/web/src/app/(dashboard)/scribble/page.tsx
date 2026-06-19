'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Send, Save, ImageIcon, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { connectSocket, getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, Card, Spinner, Badge } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
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

export default function ScribblePage() {
  const router = useRouter();
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
      const { data } = await api.get('/creative/scribbles');
      setGallery(data.data.scribbles ?? []);
    } catch {
      // Empty / unavailable gallery is non-fatal.
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
    // Ensure a live socket even if we landed here before the provider connected.
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

    const onCleared = () => {
      canvasRef.current?.clearLocal();
    };

    const onCursor = (payload: { x: number; y: number }) => {
      setPartnerCursor({ x: payload.x, y: payload.y });
    };

    // A partner just opened the canvas and wants our current state — send a
    // snapshot, but only if we actually have something to share.
    const onSyncRequest = () => {
      if (!canvasRef.current?.hasContent()) return;
      const image = canvasRef.current?.toDataURL();
      if (image) socket.emit('scribble:sync', { image });
    };

    // We received the partner's snapshot — paint it as our base layer.
    const onSync = (payload: { image?: string }) => {
      if (payload.image) canvasRef.current?.loadImage(payload.image);
    };

    socket.on('scribble:received', onReceived);
    socket.on('scribble:cleared', onCleared);
    socket.on('scribble:cursor', onCursor);
    socket.on('scribble:sync:request', onSyncRequest);
    socket.on('scribble:sync', onSync);

    // Ask the partner (if they're already on the canvas) for the current drawing.
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
    // Throttle cursor updates to ~30/sec; always send the "hide" sentinel.
    const now = Date.now();
    const hiding = point.x < 0;
    if (!hiding && now - cursorThrottle.current < 33) return;
    cursorThrottle.current = now;
    getSocket()?.emit('scribble:cursor', point);
  }, []);

  // ─── Save / Send ─────────────────────────────────────────────────────────────

  const persist = useCallback(
    async (sendAsMessage: boolean) => {
      const image = canvasRef.current?.toDataURL();
      if (!image) return;
      sendAsMessage ? setSending(true) : setSaving(true);
      try {
        const { data } = await api.post('/creative/scribbles', {
          image,
          backgroundColor: canvasRef.current?.getBackgroundColor(),
          sendAsMessage,
        });
        const scribble = data.data.scribble as ScribbleItem | undefined;
        if (scribble) setGallery((prev) => [scribble, ...prev]);

        if (sendAsMessage) {
          pushToast({ title: 'Sent to chat!', variant: 'success' });
          router.push('/chat');
        } else {
          pushToast({ title: 'Scribble saved', variant: 'success' });
        }
      } catch (err) {
        const msg =
          (err as { response?: { data?: { error?: { message?: string } } } })
            .response?.data?.error?.message ?? 'Something went wrong';
        pushToast({ title: 'Could not save', body: msg, variant: 'info' });
      } finally {
        setSending(false);
        setSaving(false);
      }
    },
    [pushToast, router],
  );

  // ─── Empty state ─────────────────────────────────────────────────────────────

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <LinkupMark size={56} className="mb-5 opacity-90" />
        <h2 className="font-display text-xl font-semibold text-text">
          Scribble together
        </h2>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          Link up with your partner to doodle on a shared canvas in real time and
          send little drawings straight to your chat.
        </p>
        <Link href="/settings" className="mt-6">
          <Button variant="outline" size="sm">
            Link your partner
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-text">
            <Pencil className="h-6 w-6 text-primary" />
            Scribble
          </h1>
          <p className="text-sm text-text-muted">
            Draw together live, then save it or send it to your chat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {partnerDrawing && (
            <Badge variant="secondary" size="md" className="animate-pulse gap-1">
              <Sparkles className="h-3 w-3" />
              Partner is drawing…
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => persist(false)}
            loading={saving}
            disabled={sending}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button
            size="sm"
            onClick={() => persist(true)}
            loading={sending}
            disabled={saving}
          >
            <Send className="h-4 w-4" />
            Send to chat
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <ScribbleCanvas
        ref={canvasRef}
        height={480}
        onLocalStroke={handleLocalStroke}
        onClear={handleClear}
        onCursorMove={handleCursorMove}
        partnerCursor={partnerCursor}
      />

      {/* Gallery */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-text-muted" />
          <h2 className="font-display text-lg font-semibold text-text">
            Your scribbles
          </h2>
        </div>

        {loadingGallery ? (
          <div className="flex justify-center py-12 text-text-muted">
            <Spinner size="md" />
          </div>
        ) : gallery.length === 0 ? (
          <Card cardStyle="bordered" className="py-10 text-center">
            <p className="text-sm text-text-muted">
              No saved scribbles yet. Draw something and hit Save.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {gallery.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'group relative overflow-hidden rounded-xl border border-border bg-white',
                  'transition-shadow hover:shadow-md',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt="Scribble"
                  className="aspect-[4/3] w-full object-contain"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-[10px] text-white/90">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
