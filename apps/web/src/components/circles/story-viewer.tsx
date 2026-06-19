'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Pause, Play } from 'lucide-react';
import { timeAgo } from '@linkup/utils';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import * as circlesApi from '@/lib/circles-api';
import type { Story, StoryTray, StoryViewer as StoryViewerUser } from './types';

const SWIPE_THRESHOLD = 60;
const TAP_ZONE = 0.3; // left/right 30% of width are nav taps

interface StoryViewerProps {
  /** One tray or a list of trays (story rings). */
  trays: StoryTray | StoryTray[];
  /** Index of the tray (circle) to open first. */
  startTrayIndex?: number;
  /** Index of the story within the starting tray. */
  startStoryIndex?: number;
  /** The viewer's OWN circle id — used to surface the owner "Seen by" affordance. */
  ownerCircleId?: string | null;
  /** Close the viewer (swipe down, X, Esc, or running off the end). */
  onClose: () => void;
  /** Fired once per story when its view is recorded — lets parents mark rings seen. */
  onStoryViewed?: (story: Story) => void;
}

/** Detect the user's reduced-motion preference (re-evaluates on change). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function StoryViewer({
  trays,
  startTrayIndex = 0,
  startStoryIndex = 0,
  ownerCircleId,
  onClose,
  onStoryViewed,
}: StoryViewerProps) {
  const trayList = useMemo(
    () => (Array.isArray(trays) ? trays : [trays]),
    [trays],
  );

  const [trayIndex, setTrayIndex] = useState(() =>
    Math.min(Math.max(startTrayIndex, 0), Math.max(trayList.length - 1, 0)),
  );
  const [storyIndex, setStoryIndex] = useState(() => Math.max(startStoryIndex, 0));
  const [progress, setProgress] = useState(0); // 0..1 of the active segment
  const [paused, setPaused] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  // Owner "Seen by" panel state.
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerUser[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const reducedMotion = useReducedMotion();

  const activeTray = trayList[trayIndex];
  const activeStory: Story | undefined = activeTray?.stories[storyIndex];

  // Refs for the animation loop so we don't re-create it every tick.
  const rafRef = useRef<number | null>(null);
  const segStartRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0); // ms already elapsed (for pause/resume)
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewedRef = useRef<Set<string>>(new Set());

  const isVideo = (activeStory?.mediaType ?? 'image') === 'video';
  const isOwnerOfActive =
    !!ownerCircleId && !!activeStory && activeStory.circleId === ownerCircleId;

  // ─── Navigation ──────────────────────────────────────────────────────────────

  const goToStory = useCallback((nextTray: number, nextStory: number) => {
    setTrayIndex(nextTray);
    setStoryIndex(nextStory);
    setProgress(0);
    setViewersOpen(false);
    setPaused(false);
    elapsedRef.current = 0;
  }, []);

  const next = useCallback(() => {
    const tray = trayList[trayIndex];
    if (!tray) {
      onClose();
      return;
    }
    if (storyIndex < tray.stories.length - 1) {
      goToStory(trayIndex, storyIndex + 1);
    } else if (trayIndex < trayList.length - 1) {
      goToStory(trayIndex + 1, 0);
    } else {
      onClose();
    }
  }, [trayList, trayIndex, storyIndex, goToStory, onClose]);

  const prev = useCallback(() => {
    if (storyIndex > 0) {
      goToStory(trayIndex, storyIndex - 1);
    } else if (trayIndex > 0) {
      const prevTray = trayList[trayIndex - 1];
      goToStory(trayIndex - 1, Math.max((prevTray?.stories.length ?? 1) - 1, 0));
    } else {
      // At the very beginning — restart current segment.
      setProgress(0);
      elapsedRef.current = 0;
    }
  }, [storyIndex, trayIndex, trayList, goToStory]);

  // ─── Record a view per segment (idempotent server-side). ─────────────────────

  useEffect(() => {
    if (!activeStory) return;
    if (viewedRef.current.has(activeStory.id)) return;
    viewedRef.current.add(activeStory.id);
    let cancelled = false;
    circlesApi
      .viewStory(activeStory.id)
      .then(() => {
        if (!cancelled) onStoryViewed?.(activeStory);
      })
      .catch(() => {
        // Non-fatal — allow a retry if we revisit.
        viewedRef.current.delete(activeStory.id);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStory, onStoryViewed]);

  // Reset per-story local UI when the story changes.
  useEffect(() => {
    setImgLoading(activeStory ? !isVideo : false);
  }, [activeStory, isVideo]);

  // ─── Progress / auto-advance loop ─────────────────────────────────────────────

  useEffect(() => {
    if (!activeStory) return;
    // Videos drive their own progress via timeupdate; skip the rAF timer.
    if (isVideo) return;
    if (imgLoading) return; // wait for the image before counting time

    const duration = Math.max(activeStory.durationMs || 5000, 500);

    if (reducedMotion) {
      // Honor reduced motion: hold a full bar, advance on a timeout, no animation.
      setProgress(1);
      if (paused) return;
      const remaining = Math.max(duration - elapsedRef.current, 0);
      const start = performance.now();
      const id = window.setTimeout(() => {
        elapsedRef.current = 0;
        next();
      }, remaining);
      return () => {
        elapsedRef.current += performance.now() - start;
        window.clearTimeout(id);
      };
    }

    if (paused) return;

    segStartRef.current = performance.now();
    const baseElapsed = elapsedRef.current;

    const tick = (now: number) => {
      const elapsed = baseElapsed + (now - segStartRef.current);
      const ratio = Math.min(elapsed / duration, 1);
      setProgress(ratio);
      elapsedRef.current = elapsed;
      if (ratio >= 1) {
        elapsedRef.current = 0;
        next();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [activeStory, isVideo, imgLoading, paused, reducedMotion, next]);

  // Pause/resume the underlying video element with the shared paused state.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => {});
  }, [paused, activeStory]);

  // ─── Keyboard ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          if (viewersOpen) setViewersOpen(false);
          else onClose();
          break;
        case 'ArrowLeft':
          prev();
          break;
        case 'ArrowRight':
          next();
          break;
        case ' ':
          e.preventDefault();
          setPaused((p) => !p);
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, next, prev, viewersOpen]);

  // ─── Owner "Seen by" ──────────────────────────────────────────────────────────

  const openViewers = useCallback(() => {
    if (!activeStory) return;
    setViewersOpen(true);
    setPaused(true);
    setViewersLoading(true);
    circlesApi
      .getStoryViewers(activeStory.id)
      .then((res) => setViewers(res.viewers))
      .catch(() => setViewers([]))
      .finally(() => setViewersLoading(false));
  }, [activeStory]);

  // ─── Pointer (tap zones + swipe) ──────────────────────────────────────────────

  const pointerDown = useRef<{ x: number; y: number; t: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerDown.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const start = pointerDown.current;
      pointerDown.current = null;
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dt = performance.now() - start.t;

      // Swipe down to close.
      if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        onClose();
        return;
      }
      // Horizontal swipe across circles / stories.
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) next();
        else prev();
        return;
      }

      // Otherwise a tap: left third = prev, right third = next, middle = pause toggle.
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const isTap = dt < 350 && Math.abs(dx) < 10 && Math.abs(dy) < 10;
      if (!isTap) return;
      if (relX < TAP_ZONE) prev();
      else if (relX > 1 - TAP_ZONE) next();
      else setPaused((p) => !p);
    },
    [next, prev, onClose],
  );

  if (!activeTray || !activeStory) return null;

  const circle = activeTray.circle;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Story viewer"
    >
      {/* Cross-tray arrows (desktop) */}
      {trayList.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => {
              if (trayIndex > 0) goToStory(trayIndex - 1, 0);
            }}
            disabled={trayIndex === 0}
            className="absolute left-2 z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-0 md:flex"
            aria-label="Previous circle"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (trayIndex < trayList.length - 1) goToStory(trayIndex + 1, 0);
            }}
            disabled={trayIndex === trayList.length - 1}
            className="absolute right-2 z-20 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-0 md:flex"
            aria-label="Next circle"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Story stage (portrait card) */}
      <div className="relative flex h-full max-h-[100dvh] w-full max-w-[min(28rem,100vw)] flex-col">
        {/* Media + interaction surface */}
        <div
          className="relative flex-1 touch-none select-none overflow-hidden bg-black sm:rounded-xl"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (pointerDown.current = null)}
        >
          {isVideo ? (
            <video
              ref={videoRef}
              key={activeStory.id}
              src={activeStory.mediaUrl}
              className="h-full w-full object-contain"
              autoPlay
              playsInline
              muted={false}
              onLoadedData={() => setImgLoading(false)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) setProgress(v.currentTime / v.duration);
              }}
              onEnded={next}
            />
          ) : (
            <img
              key={activeStory.id}
              src={activeStory.mediaUrl}
              alt={activeStory.caption || 'Story'}
              className="h-full w-full object-contain"
              draggable={false}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />
          )}

          {imgLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size="lg" className="text-white" />
            </div>
          )}

          {/* Top scrim for legibility */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />

          {/* Segmented progress bars */}
          <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-3 pt-3">
            {activeTray.stories.map((s, i) => {
              const fill =
                i < storyIndex ? 1 : i === storyIndex ? progress : 0;
              return (
                <div
                  key={s.id}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
                >
                  <div
                    className={cn(
                      'h-full rounded-full bg-white',
                      i === storyIndex && !reducedMotion
                        ? 'transition-[width] duration-100 ease-linear'
                        : '',
                    )}
                    style={{ width: `${Math.round(fill * 100)}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header */}
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-3 pt-6">
            <Avatar
              src={circle.avatarUrl}
              name={circle.name}
              size="sm"
              className="ring-2 ring-white/70"
            />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-white">
                {circle.handle ? `@${circle.handle}` : circle.name}
              </p>
              <p className="text-xs text-white/70">
                {timeAgo(activeStory.createdAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              aria-label={paused ? 'Play' : 'Pause'}
            >
              {paused ? (
                <Play className="h-5 w-5" />
              ) : (
                <Pause className="h-5 w-5" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              aria-label="Close (Esc)"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Caption + bottom scrim */}
          {activeStory.caption && (
            <div className="absolute inset-x-0 bottom-0 z-10">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
              <p
                className={cn(
                  'relative px-4 pb-5 text-center text-sm text-white drop-shadow',
                  isOwnerOfActive && 'pb-16',
                )}
              >
                {activeStory.caption}
              </p>
            </div>
          )}

          {/* Owner: Seen by N */}
          {isOwnerOfActive && (
            <button
              type="button"
              onClick={openViewers}
              className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-1.5 px-4 pb-4 pt-2 text-xs font-medium text-white/90"
            >
              <Eye className="h-4 w-4" />
              Seen by {activeStory.viewCount}
            </button>
          )}
        </div>
      </div>

      {/* Viewers sheet (owner-only) */}
      {viewersOpen && (
        <div
          className="absolute inset-0 z-30 flex items-end justify-center"
          onClick={() => setViewersOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 pb-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
                <Eye className="h-4 w-4 text-text-muted" />
                Seen by {activeStory.viewCount}
              </h3>
              <button
                type="button"
                onClick={() => setViewersOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                aria-label="Close viewers"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {viewersLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="md" className="text-primary" />
              </div>
            ) : viewers.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">
                No views yet.
              </p>
            ) : (
              <ul className="space-y-1">
                {viewers.map((v, i) => (
                  <li
                    key={`${v.user.displayName}-${i}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2"
                  >
                    <Avatar
                      src={v.user.avatarUrl}
                      name={v.user.displayName}
                      size="sm"
                    />
                    <span className="flex-1 truncate text-sm text-text">
                      {v.user.displayName}
                    </span>
                    <span className="text-xs text-text-muted">
                      {timeAgo(v.viewedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
