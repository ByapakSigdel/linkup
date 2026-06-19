'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Send, Save, ImageIcon, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, Card, Spinner, Badge } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
import {
  ScribbleCanvas,
  type ScribbleCanvasHandle,
  type RemoteScribbleStroke,
} from '@/components/creative';

interface ScribbleItem {
  id: string;
  imageUrl: string;
  createdAt: string;
}

export default function ScribblePage() {
  const router = useRouter();
  const couple = useAuthStore((s) => s.couple);
  const pushToast = useToastStore((s) => s.push);

  const canvasRef = useRef<ScribbleCanvasHandle>(null);

  const [gallery, setGallery] = useState<ScribbleItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerDrawing, setPartnerDrawing] = useState(false);
  const partnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!couple?.isPaired) return;
    const socket = getSocket();
    if (!socket) return;

    const flagPartnerDrawing = () => {
      setPartnerDrawing(true);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
      partnerTimer.current = setTimeout(() => setPartnerDrawing(false), 1200);
    };

    const onReceived = (payload: RemoteScribbleStroke & { userId?: string }) => {
      canvasRef.current?.applyRemoteStroke({
        points: payload.points,
        color: payload.color,
        width: payload.width,
      });
      flagPartnerDrawing();
    };

    const onCleared = () => {
      canvasRef.current?.clearLocal();
    };

    socket.on('scribble:received', onReceived);
    socket.on('scribble:cleared', onCleared);

    return () => {
      socket.off('scribble:received', onReceived);
      socket.off('scribble:cleared', onCleared);
      if (partnerTimer.current) clearTimeout(partnerTimer.current);
    };
  }, [couple?.isPaired]);

  const handleLocalStroke = useCallback((stroke: RemoteScribbleStroke) => {
    getSocket()?.emit('scribble:stroke', stroke);
  }, []);

  const handleClear = useCallback(() => {
    getSocket()?.emit('scribble:clear');
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
