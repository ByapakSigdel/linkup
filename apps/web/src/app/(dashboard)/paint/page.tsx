'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Palette,
  Save,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { getSocket } from '@/lib/socket';
import api from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button, Card, Spinner, Badge } from '@/components/ui';
import { LinkupMark } from '@/components/brand/logo';
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
    (err as { response?: { data?: { error?: { message?: string } } } }).response
      ?.data?.error?.message ?? 'Something went wrong'
  );
}

export default function PaintPage() {
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
      const { data } = await api.get('/creative/paintings');
      setGallery(data.data.paintings ?? []);
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

    const onCleared = () => {
      canvasRef.current?.clearLocal();
    };

    const onCursor = (payload: { x: number; y: number; userId?: string }) => {
      setPartnerCursor({ x: payload.x, y: payload.y });
    };

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
    if (now - cursorThrottle.current < 40) return; // ~25fps
    cursorThrottle.current = now;
    getSocket()?.emit('painting:cursor', point);
  }, []);

  // ─── New canvas / Save ───────────────────────────────────────────────────────

  const newCanvas = useCallback(async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/creative/paintings', {
        title: title || 'Untitled',
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: canvasRef.current?.getBackgroundColor() ?? '#FFFFFF',
      });
      const painting = data.data.painting as PaintingSummary | undefined;
      const newId = painting?.id ?? data.data.sessionId ?? null;
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
    const imageUrl = canvasRef.current?.toDataURL();
    const thumbnailUrl = canvasRef.current?.toThumbnailDataURL(320);
    if (!imageUrl) return;
    setSaving(true);
    try {
      let id = paintingId;
      // No active painting yet → create one first.
      if (!id) {
        const { data } = await api.post('/creative/paintings', {
          title: title || 'Untitled',
          width: CANVAS_W,
          height: CANVAS_H,
          backgroundColor: canvasRef.current?.getBackgroundColor() ?? '#FFFFFF',
        });
        id = (data.data.painting?.id ?? data.data.sessionId) as string | null;
        setPaintingId(id ?? null);
      }
      if (!id) throw new Error('No painting id');

      const { data } = await api.patch(`/creative/paintings/${id}`, {
        imageUrl,
        thumbnailUrl,
        title: title || 'Untitled',
        status: 'saved',
      });
      const saved = data.data.painting as PaintingSummary | undefined;

      setGallery((prev) => {
        const next: PaintingSummary = saved ?? {
          id: id!,
          title: title || 'Untitled',
          thumbnailUrl: thumbnailUrl ?? undefined,
          imageUrl,
          createdAt: new Date().toISOString(),
        };
        const without = prev.filter((p) => p.id !== id);
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
        const { data } = await api.get(`/creative/paintings/${id}`);
        const painting = data.data.painting;
        setPaintingId(id);
        setTitle(painting?.title ?? '');
        if (painting?.imageUrl) {
          canvasRef.current?.loadImage(painting.imageUrl);
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
    async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
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

  // ─── Empty state ─────────────────────────────────────────────────────────────

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <LinkupMark size={56} className="mb-5 opacity-90" />
        <h2 className="font-display text-xl font-semibold text-text">
          Paint together
        </h2>
        <p className="mt-2 max-w-sm text-sm text-text-muted">
          Link up with your partner to create art together on a shared canvas,
          with live brushes and a roaming partner cursor.
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
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-text">
            <Palette className="h-6 w-6 text-primary" />
            Paint
          </h1>
          <p className="text-sm text-text-muted">
            A shared studio — brushes, fill, opacity and real-time co-painting.
          </p>
        </div>
        {partnerActive && (
          <Badge variant="secondary" size="md" className="animate-pulse gap-1">
            <Sparkles className="h-3 w-3" />
            Partner is painting…
          </Badge>
        )}
      </div>

      {/* Title + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled painting…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
        />
        <Button variant="outline" size="sm" onClick={newCanvas} loading={creating}>
          <Plus className="h-4 w-4" />
          New canvas
        </Button>
        <Button size="sm" onClick={save} loading={saving}>
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>

      {/* Canvas */}
      <PaintCanvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onLocalStroke={handleLocalStroke}
        onClear={handleClear}
        onCursorMove={handleCursorMove}
        partnerCursor={partnerCursor}
      />

      {/* Gallery */}
      <div className="space-y-3 pt-2">
        <h2 className="font-display text-lg font-semibold text-text">
          Saved paintings
        </h2>

        {loadingGallery ? (
          <div className="flex justify-center py-12 text-text-muted">
            <Spinner size="md" />
          </div>
        ) : gallery.length === 0 ? (
          <Card cardStyle="bordered" className="py-10 text-center">
            <p className="text-sm text-text-muted">
              No paintings yet. Create something and hit Save.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((p) => {
              const thumb = p.thumbnailUrl || p.imageUrl;
              return (
                <button
                  key={p.id}
                  onClick={() => open(p.id)}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border border-border bg-white text-left',
                    'transition-shadow hover:shadow-md',
                    paintingId === p.id && 'ring-2 ring-primary',
                  )}
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={p.title}
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] w-full items-center justify-center bg-surface">
                      <Palette className="h-6 w-6 text-text-muted" />
                    </div>
                  )}

                  {openingId === p.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1 p-2">
                    <span className="truncate text-xs font-medium text-text">
                      {p.title || 'Untitled'}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => remove(p.id, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') remove(p.id, e as unknown as React.MouseEvent);
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-all hover:bg-error/10 hover:text-error group-hover:opacity-100"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
