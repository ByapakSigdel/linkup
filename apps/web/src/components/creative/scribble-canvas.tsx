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
  Pen,
  Highlighter,
  Eraser,
  Circle,
  Square,
  Minus,
  ArrowRight,
  Undo,
  Redo,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export type ScribbleTool =
  | 'pen'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'circle'
  | 'rectangle'
  | 'arrow';

/** A point in canvas pixel space. */
interface Point {
  x: number;
  y: number;
}

/** A point normalized to 0..1 of the canvas size — used over the wire so it
 * renders correctly on a partner's differently-sized canvas. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

interface Stroke {
  id: string;
  tool: ScribbleTool;
  color: string;
  thickness: number;
  opacity: number;
  points: Point[];
}

/** Shape emitted/received over the socket for a freehand stroke. */
export interface RemoteScribbleStroke {
  points: NormalizedPoint[];
  color: string;
  width: number;
}

export interface ScribbleCanvasHandle {
  /** PNG data URL of the current canvas. */
  toDataURL: () => string | null;
  /** Apply a stroke received from the partner. */
  applyRemoteStroke: (stroke: RemoteScribbleStroke) => void;
  /** Clear the canvas (local only — does not emit). */
  clearLocal: () => void;
  /** The canvas background color currently in use. */
  getBackgroundColor: () => string;
}

interface ScribbleCanvasProps {
  width?: number;
  height?: number;
  className?: string;
  /** Fired when the local user finishes a freehand stroke, with normalized
   * points so the partner can render it on a differently-sized canvas. */
  onLocalStroke?: (stroke: RemoteScribbleStroke) => void;
  /** Fired when the local user clears the canvas. */
  onClear?: () => void;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6B6B',
  '#FF9500', '#FFD93D', '#51CF66', '#6BCB77',
  '#339AF0', '#5C7CFA', '#845EF7', '#A084DC',
  '#F06595', '#FF6B9D', '#868E96', '#495057',
];

const TOOL_CONFIG: Record<
  ScribbleTool,
  { opacity: number; compositeOp: GlobalCompositeOperation }
> = {
  pen: { opacity: 1, compositeOp: 'source-over' },
  marker: { opacity: 0.8, compositeOp: 'source-over' },
  highlighter: { opacity: 0.3, compositeOp: 'source-over' },
  eraser: { opacity: 1, compositeOp: 'destination-out' },
  line: { opacity: 1, compositeOp: 'source-over' },
  circle: { opacity: 1, compositeOp: 'source-over' },
  rectangle: { opacity: 1, compositeOp: 'source-over' },
  arrow: { opacity: 1, compositeOp: 'source-over' },
};

export const ScribbleCanvas = forwardRef<
  ScribbleCanvasHandle,
  ScribbleCanvasProps
>(function ScribbleCanvas(
  { width = 1280, height = 800, className, onLocalStroke, onClear },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tool, setTool] = useState<ScribbleTool>('pen');
  const [color, setColor] = useState('#000000');
  const [thickness, setThickness] = useState(4);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const isDrawingRef = useRef(false);

  /** Remote strokes are painted directly onto the canvas (they live outside the
   * local undo history so a local undo never wipes the partner's work). */
  const remoteStrokesRef = useRef<Stroke[]>([]);

  const isShapeTool = ['line', 'circle', 'rectangle', 'arrow'].includes(tool);

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent): Point => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [width, height],
  );

  // ─── Drawing primitives ────────────────────────────────────────────────────

  const paintStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const config = TOOL_CONFIG[stroke.tool];
    if (!config) return;
    ctx.globalAlpha = stroke.opacity;
    ctx.globalCompositeOperation = config.compositeOp;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (['pen', 'marker', 'highlighter', 'eraser'].includes(stroke.tool)) {
      if (stroke.points.length < 2) {
        // Single tap — draw a dot.
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
    } else if (stroke.points.length >= 2) {
      const start = stroke.points[0]!;
      const end = stroke.points[stroke.points.length - 1]!;
      if (stroke.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      } else if (stroke.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = Math.max(stroke.thickness * 3, 12);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle - Math.PI / 6),
          end.y - headLen * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLen * Math.cos(angle + Math.PI / 6),
          end.y - headLen * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
      } else if (stroke.tool === 'rectangle') {
        ctx.beginPath();
        ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.stroke();
      } else if (stroke.tool === 'circle') {
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, []);

  const redraw = useCallback(
    (strokeList: Stroke[], activeStroke?: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Partner strokes first, then ours, then the in-progress stroke.
      for (const s of remoteStrokesRef.current) paintStroke(ctx, s);
      for (const s of strokeList) paintStroke(ctx, s);
      if (activeStroke) paintStroke(ctx, activeStroke);

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    [width, height, backgroundColor, paintStroke],
  );

  useEffect(() => {
    redraw(strokes);
  }, [strokes, redraw]);

  // ─── Imperative handle ─────────────────────────────────────────────────────

  useImperativeHandle(
    ref,
    () => ({
      toDataURL: () => canvasRef.current?.toDataURL('image/png') ?? null,
      applyRemoteStroke: (remote) => {
        const stroke: Stroke = {
          id: `remote-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          tool: 'pen',
          color: remote.color,
          thickness: remote.width,
          opacity: 1,
          points: remote.points.map((p) => ({ x: p.x * width, y: p.y * height })),
        };
        remoteStrokesRef.current.push(stroke);
        // Paint just the new stroke without a full clear (preserves everything).
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          paintStroke(ctx, stroke);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      },
      clearLocal: () => {
        remoteStrokesRef.current = [];
        setStrokes([]);
        setUndoneStrokes([]);
      },
      getBackgroundColor: () => backgroundColor,
    }),
    [width, height, paintStroke, backgroundColor],
  );

  // ─── Pointer handlers ──────────────────────────────────────────────────────

  const startDrawing = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const point = getCanvasPoint(e);
      const config = TOOL_CONFIG[tool]!;
      setCurrentStroke({
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tool,
        color: tool === 'eraser' ? '#000000' : color,
        thickness: tool === 'highlighter' ? thickness * 3 : thickness,
        opacity: config.opacity,
        points: [point],
      });
      isDrawingRef.current = true;
    },
    [tool, color, thickness, getCanvasPoint],
  );

  const draw = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const point = getCanvasPoint(e);
      setCurrentStroke((prev) => {
        if (!prev) return prev;
        const updated: Stroke = isShapeTool
          ? { ...prev, points: [prev.points[0]!, point] }
          : { ...prev, points: [...prev.points, point] };
        redraw(strokes, updated);
        return updated;
      });
    },
    [getCanvasPoint, isShapeTool, strokes, redraw],
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setCurrentStroke((prev) => {
      if (prev && prev.points.length >= 1) {
        setStrokes((s) => [...s, prev]);
        setUndoneStrokes([]);
        // Broadcast freehand strokes to the partner (normalized 0..1).
        if (
          onLocalStroke &&
          ['pen', 'marker', 'highlighter', 'eraser'].includes(prev.tool) &&
          prev.points.length >= 1
        ) {
          onLocalStroke({
            points: prev.points.map((p) => ({ x: p.x / width, y: p.y / height })),
            color: prev.tool === 'eraser' ? backgroundColor : prev.color,
            width: prev.thickness,
          });
        }
      }
      return null;
    });
  }, [onLocalStroke, width, height, backgroundColor]);

  // ─── Actions ───────────────────────────────────────────────────────────────

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

  const tools: { id: ScribbleTool; icon: typeof Pen; label: string }[] = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
    { id: 'line', icon: Minus, label: 'Line' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  ];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2">
        {/* Tools */}
        <div className="flex items-center gap-0.5 border-r border-border pr-2">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              title={label}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                tool === id
                  ? 'bg-primary text-text-on-primary'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1 border-r border-border pr-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-all',
                color === c
                  ? 'scale-110 border-primary'
                  : 'border-border hover:border-primary/50',
              )}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
          <label
            className="ml-1 flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-border"
            title="Custom color"
          >
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>

        {/* Size */}
        <div className="flex items-center gap-2 border-r border-border pr-2">
          <span className="text-xs text-text-muted">Size</span>
          <input
            type="range"
            min="1"
            max="30"
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            className="w-20 accent-primary"
          />
          <span className="w-5 text-xs text-text-muted">{thickness}</span>
        </div>

        {/* Background */}
        <div className="flex items-center gap-2 border-r border-border pr-2">
          <span className="text-xs text-text-muted">BG</span>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-border"
            title="Background color"
          />
        </div>

        {/* History / clear */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={undoneStrokes.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </button>
          <button
            onClick={clear}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-error"
            title="Clear all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair touch-none"
          style={{ aspectRatio: `${width}/${height}` }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
        />
      </div>
    </div>
  );
});
