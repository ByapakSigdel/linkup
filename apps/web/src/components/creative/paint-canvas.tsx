'use client';

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Paintbrush,
  PenLine,
  Highlighter,
  Eraser,
  PaintBucket,
  Undo,
  Redo,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type PaintTool = 'brush' | 'pen' | 'marker' | 'eraser' | 'fill';

interface Point {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

interface PaintStroke {
  id: string;
  tool: PaintTool;
  color: string;
  thickness: number;
  opacity: number;
  points: Point[];
}

/** Shape emitted/received over the socket for a painting stroke. */
export interface RemotePaintStroke {
  points: NormalizedPoint[];
  color: string;
  width: number;
  tool: PaintTool;
  opacity?: number;
}

export interface PaintCanvasHandle {
  toDataURL: () => string | null;
  /** Small thumbnail data URL (downscaled) for galleries. */
  toThumbnailDataURL: (maxWidth?: number) => string | null;
  applyRemoteStroke: (stroke: RemotePaintStroke) => void;
  clearLocal: () => void;
  /** Paint an existing image (e.g. a saved painting) onto the canvas. */
  loadImage: (url: string) => void;
  getBackgroundColor: () => string;
}

interface PaintCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  /** Fired when the local user finishes a stroke (normalized 0..1). */
  onLocalStroke?: (stroke: RemotePaintStroke) => void;
  /** Fired when the local user clears. */
  onClear?: () => void;
  /** Fired as the local pointer moves over the canvas (normalized 0..1). */
  onCursorMove?: (point: NormalizedPoint) => void;
  /** Partner's live cursor, normalized 0..1, or null to hide. */
  partnerCursor?: NormalizedPoint | null;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF4444',
  '#FF6B6B', '#FF9500', '#FFD93D', '#FFEC99',
  '#51CF66', '#6BCB77', '#339AF0', '#5C7CFA',
  '#845EF7', '#A084DC', '#F06595', '#FF6B9D',
  '#495057', '#868E96', '#ADB5BD', '#DEE2E6',
  '#8B4513', '#D2691E', '#F4A460', '#FFDAB9',
];

const TOOL_SETTINGS: Record<
  PaintTool,
  { baseThickness: number; opacity: number; compositeOp: GlobalCompositeOperation }
> = {
  brush: { baseThickness: 8, opacity: 1, compositeOp: 'source-over' },
  pen: { baseThickness: 2, opacity: 1, compositeOp: 'source-over' },
  marker: { baseThickness: 18, opacity: 0.4, compositeOp: 'source-over' },
  eraser: { baseThickness: 20, opacity: 1, compositeOp: 'destination-out' },
  fill: { baseThickness: 1, opacity: 1, compositeOp: 'source-over' },
};

/** Parse a hex color to an [r,g,b] tuple. */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export const PaintCanvas = forwardRef<PaintCanvasHandle, PaintCanvasProps>(
  function PaintCanvas(
    {
      width = 1280,
      height = 800,
      className,
      onLocalStroke,
      onClear,
      onCursorMove,
      partnerCursor,
    },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [tool, setTool] = useState<PaintTool>('brush');
    const [color, setColor] = useState('#339AF0');
    const [sizeMultiplier, setSizeMultiplier] = useState(1);
    const [opacity, setOpacity] = useState(1);
    const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

    const [strokes, setStrokes] = useState<PaintStroke[]>([]);
    const [undoneStrokes, setUndoneStrokes] = useState<PaintStroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<PaintStroke | null>(null);
    const isDrawingRef = useRef(false);

    /** Persisted background snapshots (data URLs) for fills + image loads —
     * these are baked into the base layer beneath the vector strokes. */
    const [baseImage, setBaseImage] = useState<string | null>(null);
    const baseImageElRef = useRef<HTMLImageElement | null>(null);

    const remoteStrokesRef = useRef<PaintStroke[]>([]);

    const getCanvasPoint = useCallback(
      (e: React.PointerEvent): Point => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((e.clientX - rect.left) / rect.width) * width,
          y: ((e.clientY - rect.top) / rect.height) * height,
        };
      },
      [width, height],
    );

    // ─── Drawing primitives ──────────────────────────────────────────────────

    const paintStroke = useCallback(
      (ctx: CanvasRenderingContext2D, stroke: PaintStroke) => {
        const settings = TOOL_SETTINGS[stroke.tool];
        if (!settings || stroke.tool === 'fill') return;

        ctx.globalAlpha = stroke.opacity;
        ctx.globalCompositeOperation = settings.compositeOp;
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.points.length < 2) {
          const p = stroke.points[0];
          if (p) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(stroke.thickness / 2, 0.5), 0, Math.PI * 2);
            ctx.fill();
          }
          return;
        }

        ctx.beginPath();
        const first = stroke.points[0]!;
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const cur = stroke.points[i]!;
          const next = stroke.points[i + 1]!;
          ctx.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
        }
        const last = stroke.points[stroke.points.length - 1]!;
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      },
      [],
    );

    const redraw = useCallback(
      (strokeList: PaintStroke[], activeStroke?: PaintStroke | null) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Base layer: filled regions + any loaded image.
        const baseEl = baseImageElRef.current;
        if (baseEl && baseEl.complete && baseEl.naturalWidth > 0) {
          ctx.drawImage(baseEl, 0, 0, width, height);
        }

        for (const s of remoteStrokesRef.current) paintStroke(ctx, s);
        for (const s of strokeList) paintStroke(ctx, s);
        if (activeStroke) paintStroke(ctx, activeStroke);

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      },
      [width, height, backgroundColor, paintStroke],
    );

    // Keep the base image element in sync with the baseImage data URL.
    useEffect(() => {
      if (!baseImage) {
        baseImageElRef.current = null;
        redraw(strokes);
        return;
      }
      const img = new Image();
      img.onload = () => {
        baseImageElRef.current = img;
        redraw(strokes);
      };
      img.src = baseImage;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseImage]);

    useEffect(() => {
      redraw(strokes);
    }, [strokes, redraw]);

    // ─── Flood fill (bucket) ─────────────────────────────────────────────────

    const floodFill = useCallback(
      (startX: number, startY: number, fillHex: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const sx = Math.floor(startX);
        const sy = Math.floor(startY);
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) return;

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const startIdx = (sy * width + sx) * 4;
        const tr = data[startIdx] ?? 0;
        const tg = data[startIdx + 1] ?? 0;
        const tb = data[startIdx + 2] ?? 0;
        const ta = data[startIdx + 3] ?? 0;
        const [fr, fg, fb] = hexToRgb(fillHex);

        // Already the fill color → nothing to do.
        if (tr === fr && tg === fg && tb === fb && ta === 255) {
          return;
        }

        const tolerance = 32;
        const matches = (idx: number) =>
          Math.abs((data[idx] ?? 0) - tr) <= tolerance &&
          Math.abs((data[idx + 1] ?? 0) - tg) <= tolerance &&
          Math.abs((data[idx + 2] ?? 0) - tb) <= tolerance &&
          Math.abs((data[idx + 3] ?? 0) - ta) <= tolerance;

        const stack: number[] = [sx, sy];
        while (stack.length > 0) {
          const y = stack.pop()!;
          const x = stack.pop()!;
          let nx = x;
          // Move to the left edge of the matching span.
          let idx = (y * width + nx) * 4;
          while (nx >= 0 && matches(idx)) {
            nx--;
            idx -= 4;
          }
          nx++;
          idx = (y * width + nx) * 4;
          let spanUp = false;
          let spanDown = false;
          while (nx < width && matches(idx)) {
            data[idx] = fr;
            data[idx + 1] = fg;
            data[idx + 2] = fb;
            data[idx + 3] = 255;

            if (y > 0) {
              const upIdx = ((y - 1) * width + nx) * 4;
              if (matches(upIdx)) {
                if (!spanUp) {
                  stack.push(nx, y - 1);
                  spanUp = true;
                }
              } else {
                spanUp = false;
              }
            }
            if (y < height - 1) {
              const downIdx = ((y + 1) * width + nx) * 4;
              if (matches(downIdx)) {
                if (!spanDown) {
                  stack.push(nx, y + 1);
                  spanDown = true;
                }
              } else {
                spanDown = false;
              }
            }
            nx++;
            idx += 4;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        // Bake the result into the base layer so vector strokes redraw above it.
        setBaseImage(canvas.toDataURL('image/png'));
        setUndoneStrokes([]);
      },
      [width, height],
    );

    // ─── Imperative handle ───────────────────────────────────────────────────

    useImperativeHandle(
      ref,
      () => ({
        toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null,
        toThumbnailDataURL: (maxWidth = 320) => {
          const canvas = canvasRef.current;
          if (!canvas) return null;
          const ratio = maxWidth / width;
          const tw = Math.round(width * ratio);
          const th = Math.round(height * ratio);
          const off = document.createElement('canvas');
          off.width = tw;
          off.height = th;
          const octx = off.getContext('2d');
          if (!octx) return null;
          octx.drawImage(canvas, 0, 0, tw, th);
          return off.toDataURL('image/png');
        },
        applyRemoteStroke: (remote) => {
          const stroke: PaintStroke = {
            id: `remote-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            tool: remote.tool,
            color: remote.color,
            thickness: remote.width,
            opacity: remote.opacity ?? TOOL_SETTINGS[remote.tool]?.opacity ?? 1,
            points: remote.points.map((p) => ({ x: p.x * width, y: p.y * height })),
          };
          remoteStrokesRef.current.push(stroke);
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) {
            paintStroke(ctx, stroke);
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
          }
        },
        clearLocal: () => {
          remoteStrokesRef.current = [];
          baseImageElRef.current = null;
          setBaseImage(null);
          setStrokes([]);
          setUndoneStrokes([]);
        },
        loadImage: (url) => {
          remoteStrokesRef.current = [];
          setStrokes([]);
          setUndoneStrokes([]);
          setBaseImage(url);
        },
        getBackgroundColor: () => backgroundColor,
      }),
      [width, height, paintStroke, backgroundColor],
    );

    // ─── Pointer handlers ────────────────────────────────────────────────────

    const startDrawing = useCallback(
      (e: React.PointerEvent) => {
        e.preventDefault();
        const point = getCanvasPoint(e);

        if (tool === 'fill') {
          floodFill(point.x, point.y, color);
          // Broadcast as a "fill" stroke (partner re-runs the fill at the point).
          onLocalStroke?.({
            points: [{ x: point.x / width, y: point.y / height }],
            color,
            width: 1,
            tool: 'fill',
            opacity: 1,
          });
          return;
        }

        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        const settings = TOOL_SETTINGS[tool]!;
        setCurrentStroke({
          id: `paint-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tool,
          color: tool === 'eraser' ? '#000000' : color,
          thickness: settings.baseThickness * sizeMultiplier,
          opacity: tool === 'eraser' ? 1 : opacity * settings.opacity,
          points: [point],
        });
        isDrawingRef.current = true;
      },
      [tool, color, sizeMultiplier, opacity, getCanvasPoint, floodFill, onLocalStroke, width, height],
    );

    const draw = useCallback(
      (e: React.PointerEvent) => {
        const point = getCanvasPoint(e);
        onCursorMove?.({ x: point.x / width, y: point.y / height });

        if (!isDrawingRef.current) return;
        e.preventDefault();
        setCurrentStroke((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, points: [...prev.points, point] };
          redraw(strokes, updated);
          return updated;
        });
      },
      [getCanvasPoint, onCursorMove, width, height, strokes, redraw],
    );

    const stopDrawing = useCallback(() => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      setCurrentStroke((prev) => {
        if (prev && prev.points.length >= 1) {
          setStrokes((s) => [...s, prev]);
          setUndoneStrokes([]);
          onLocalStroke?.({
            points: prev.points.map((p) => ({ x: p.x / width, y: p.y / height })),
            color: prev.tool === 'eraser' ? backgroundColor : prev.color,
            width: prev.thickness,
            tool: prev.tool,
            opacity: prev.opacity,
          });
        }
        return null;
      });
    }, [onLocalStroke, width, height, backgroundColor]);

    // ─── Actions ─────────────────────────────────────────────────────────────

    const undo = useCallback(() => {
      setStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        setUndoneStrokes((u) => [...u, last]);
        return prev.slice(0, -1);
      });
    }, []);

    const redo = useCallback(() => {
      setUndoneStrokes((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        setStrokes((s) => [...s, last]);
        return prev.slice(0, -1);
      });
    }, []);

    const clear = useCallback(() => {
      remoteStrokesRef.current = [];
      baseImageElRef.current = null;
      setBaseImage(null);
      setStrokes([]);
      setUndoneStrokes([]);
      onClear?.();
    }, [onClear]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
          } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
            e.preventDefault();
            redo();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const toolButtons: { id: PaintTool; icon: typeof Paintbrush; label: string }[] = [
      { id: 'brush', icon: Paintbrush, label: 'Brush' },
      { id: 'pen', icon: PenLine, label: 'Pen (fine)' },
      { id: 'marker', icon: Highlighter, label: 'Marker (wide)' },
      { id: 'eraser', icon: Eraser, label: 'Eraser' },
      { id: 'fill', icon: PaintBucket, label: 'Fill bucket' },
    ];

    const previewSize = Math.max(
      4,
      (TOOL_SETTINGS[tool]?.baseThickness ?? 8) * sizeMultiplier * 0.5,
    );

    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <div className="flex gap-3">
          {/* Left toolbar */}
          <div className="flex flex-col gap-2 self-start rounded-xl border border-border bg-surface p-2">
            {toolButtons.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                title={label}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                  tool === id
                    ? 'bg-primary text-text-on-primary'
                    : 'text-text-muted hover:bg-surface-hover hover:text-text',
                )}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            <button
              onClick={undo}
              disabled={strokes.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="h-5 w-5" />
            </button>
            <button
              onClick={redo}
              disabled={undoneStrokes.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo className="h-5 w-5" />
            </button>
            <button
              onClick={clear}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-error"
              title="Clear all"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>

          {/* Canvas */}
          <div className="relative flex-1 overflow-hidden rounded-xl border border-border bg-white">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className={cn(
                'w-full touch-none',
                tool === 'fill' ? 'cursor-cell' : 'cursor-crosshair',
              )}
              style={{ aspectRatio: `${width}/${height}` }}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              onPointerLeave={(e) => {
                stopDrawing();
                onCursorMove?.({ x: -1, y: -1 });
                void e;
              }}
            />

            {/* Partner cursor */}
            {partnerCursor &&
              partnerCursor.x >= 0 &&
              partnerCursor.y >= 0 && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${partnerCursor.x * 100}%`,
                    top: `${partnerCursor.y * 100}%`,
                  }}
                >
                  <div className="h-3 w-3 rounded-full bg-accent shadow-[0_0_0_3px] shadow-accent/30" />
                  <span className="ml-3 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-text-on-primary">
                    Partner
                  </span>
                </div>
              )}
          </div>
        </div>

        {/* Bottom controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-2">
          {/* Colors */}
          <div className="flex flex-wrap items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-all',
                  color === c
                    ? 'scale-110 border-primary shadow-sm'
                    : 'border-transparent hover:border-primary/40',
                )}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <label
              className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-border"
              title="Custom color"
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-9 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
          </div>

          <div className="mx-1 h-8 border-l border-border" />

          {/* Size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Size</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.25"
              value={sizeMultiplier}
              onChange={(e) => setSizeMultiplier(Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <div
              className="rounded-full bg-text"
              style={{ width: `${previewSize}px`, height: `${previewSize}px` }}
            />
          </div>

          <div className="mx-1 h-8 border-l border-border" />

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Opacity</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-24 accent-primary"
            />
            <span className="w-8 text-xs text-text-muted">
              {Math.round(opacity * 100)}%
            </span>
          </div>

          <div className="mx-1 h-8 border-l border-border" />

          {/* Background */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">BG</span>
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-border"
              title="Background color"
            />
          </div>
        </div>
      </div>
    );
  },
);
