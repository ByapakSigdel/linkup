'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
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
  Download,
  Send,
  Type,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';

export type ScribbleTool =
  | 'pen'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'circle'
  | 'rectangle'
  | 'arrow';

interface Stroke {
  id: string;
  tool: ScribbleTool;
  color: string;
  thickness: number;
  opacity: number;
  points: { x: number; y: number; pressure?: number }[];
}

interface ScribbleCanvasProps {
  width?: number;
  height?: number;
  onSend?: (dataUrl: string) => void;
  className?: string;
}

const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#FF6B6B',
  '#FF9500', '#FFD93D', '#51CF66', '#6BCB77',
  '#339AF0', '#5C7CFA', '#845EF7', '#A084DC',
  '#F06595', '#FF6B9D', '#868E96', '#495057',
];

const TOOL_CONFIG: Record<ScribbleTool, { opacity: number; compositeOp: GlobalCompositeOperation }> = {
  pen: { opacity: 1, compositeOp: 'source-over' },
  marker: { opacity: 0.8, compositeOp: 'source-over' },
  highlighter: { opacity: 0.3, compositeOp: 'source-over' },
  eraser: { opacity: 1, compositeOp: 'destination-out' },
  line: { opacity: 1, compositeOp: 'source-over' },
  circle: { opacity: 1, compositeOp: 'source-over' },
  rectangle: { opacity: 1, compositeOp: 'source-over' },
  arrow: { opacity: 1, compositeOp: 'source-over' },
};

export function ScribbleCanvas({
  width = 1920,
  height = 1080,
  onSend,
  className,
}: ScribbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<ScribbleTool>('pen');
  const [color, setColor] = useState('#000000');
  const [thickness, setThickness] = useState(3);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Shape start point for line/circle/rect/arrow tools
  const shapeStart = useRef<{ x: number; y: number } | null>(null);

  const isShapeTool = ['line', 'circle', 'rectangle', 'arrow'].includes(tool);

  // Get canvas-relative coordinates
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;

      let clientX: number, clientY: number;
      if ('touches' in e) {
        const touch = e.touches[0];
        if (!touch) return { x: 0, y: 0 };
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [width, height],
  );

  // Redraw all strokes
  const redraw = useCallback(
    (strokeList: Stroke[], activeStroke?: Stroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear and fill background
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      const allStrokes = activeStroke
        ? [...strokeList, activeStroke]
        : strokeList;

      for (const stroke of allStrokes) {
        const config = TOOL_CONFIG[stroke.tool];
        if (!config) continue;
        ctx.globalAlpha = stroke.opacity;
        ctx.globalCompositeOperation = config.compositeOp;
        ctx.strokeStyle = stroke.color;
        ctx.fillStyle = stroke.color;
        ctx.lineWidth = stroke.thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (['pen', 'marker', 'highlighter', 'eraser'].includes(stroke.tool)) {
          // Freehand stroke
          if (stroke.points.length < 2) continue;
          ctx.beginPath();
          const first = stroke.points[0]!;
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < stroke.points.length; i++) {
            const pt = stroke.points[i]!;
            ctx.lineTo(pt.x, pt.y);
          }
          ctx.stroke();
        } else if (stroke.tool === 'line' && stroke.points.length >= 2) {
          const start = stroke.points[0]!;
          const end = stroke.points[stroke.points.length - 1]!;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
        } else if (stroke.tool === 'arrow' && stroke.points.length >= 2) {
          const start = stroke.points[0]!;
          const end = stroke.points[stroke.points.length - 1]!;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          // Arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const headLen = Math.max(stroke.thickness * 3, 10);
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
        } else if (stroke.tool === 'rectangle' && stroke.points.length >= 2) {
          const start = stroke.points[0]!;
          const end = stroke.points[stroke.points.length - 1]!;
          ctx.beginPath();
          ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
          ctx.stroke();
        } else if (stroke.tool === 'circle' && stroke.points.length >= 2) {
          const start = stroke.points[0]!;
          const end = stroke.points[stroke.points.length - 1]!;
          const rx = Math.abs(end.x - start.x) / 2;
          const ry = Math.abs(end.y - start.y) / 2;
          const cx = (start.x + end.x) / 2;
          const cy = (start.y + end.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    [width, height, backgroundColor],
  );

  // Redraw when strokes change
  useEffect(() => {
    redraw(strokes);
  }, [strokes, redraw]);

  // ─── Mouse/Touch Handlers ─────────────────────────────────────────────────

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const config = TOOL_CONFIG[tool]!;

      const newStroke: Stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tool,
        color: tool === 'eraser' ? '#000000' : color,
        thickness: tool === 'highlighter' ? thickness * 3 : thickness,
        opacity: config.opacity,
        points: [point],
      };

      setCurrentStroke(newStroke);
      setIsDrawing(true);
      if (isShapeTool) {
        shapeStart.current = point;
      }
    },
    [tool, color, thickness, getCanvasPoint, isShapeTool],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing || !currentStroke) return;

      const point = getCanvasPoint(e);

      if (isShapeTool) {
        // For shapes, replace the last point with the current position
        const updated = {
          ...currentStroke,
          points: [currentStroke.points[0]!, point],
        };
        setCurrentStroke(updated);
        redraw(strokes, updated);
      } else {
        const updated = {
          ...currentStroke,
          points: [...currentStroke.points, point],
        };
        setCurrentStroke(updated);
        redraw(strokes, updated);
      }
    },
    [isDrawing, currentStroke, getCanvasPoint, isShapeTool, strokes, redraw],
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);

    if (currentStroke.points.length >= 1) {
      setStrokes((prev) => [...prev, currentStroke]);
      setUndoneStrokes([]);
    }
    setCurrentStroke(null);
    shapeStart.current = null;
  }, [isDrawing, currentStroke]);

  // ─── Actions ──────────────────────────────────────────────────────────────

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
    setStrokes([]);
    setUndoneStrokes([]);
  }, []);

  const exportAsPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `scribble-${Date.now()}.png`;
    a.click();
  }, []);

  const handleSend = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSend) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSend(dataUrl);
  }, [onSend]);

  // ─── Keyboard shortcuts ──────────────────────────────────────────────────

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

  // ─── Tool buttons config ──────────────────────────────────────────────────

  const tools: { id: ScribbleTool; icon: typeof Pen; label: string }[] = [
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'marker', icon: Type, label: 'Marker' },
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
        {/* Tool buttons */}
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

        {/* Color palette */}
        <div className="flex items-center gap-1 border-r border-border pr-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'h-6 w-6 rounded-full border-2 transition-all',
                color === c
                  ? 'border-primary scale-110'
                  : 'border-border hover:border-primary/50',
              )}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        {/* Thickness slider */}
        <div className="flex items-center gap-2 border-r border-border pr-2">
          <span className="text-xs text-text-muted">Size</span>
          <input
            type="range"
            min="1"
            max="20"
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            className="w-20 accent-primary"
          />
          <span className="text-xs text-text-muted w-4">{thickness}</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={undoneStrokes.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo className="h-4 w-4" />
          </button>
          <button
            onClick={clear}
            disabled={strokes.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-error disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Clear all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={exportAsPng}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text transition-colors"
            title="Download as PNG"
          >
            <Download className="h-4 w-4" />
          </button>

          {onSend && (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={strokes.length === 0}
              className="ml-2"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-border overflow-hidden bg-white"
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair touch-none"
          style={{ aspectRatio: `${width}/${height}` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}
