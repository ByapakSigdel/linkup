'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Pen,
  Paintbrush,
  Highlighter,
  Eraser,
  Undo,
  Redo,
  Trash2,
  Download,
  Save,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';

type PaintTool = 'brush' | 'pen' | 'marker' | 'eraser';

interface PaintStroke {
  id: string;
  tool: PaintTool;
  color: string;
  thickness: number;
  opacity: number;
  points: { x: number; y: number }[];
}

interface PaintCanvasProps {
  className?: string;
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
  brush: { baseThickness: 8, opacity: 0.9, compositeOp: 'source-over' },
  pen: { baseThickness: 2, opacity: 1, compositeOp: 'source-over' },
  marker: { baseThickness: 15, opacity: 0.5, compositeOp: 'source-over' },
  eraser: { baseThickness: 20, opacity: 1, compositeOp: 'destination-out' },
};

export function PaintCanvas({ className }: PaintCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1920, height: 1080 });

  const [tool, setTool] = useState<PaintTool>('brush');
  const [color, setColor] = useState('#339AF0');
  const [sizeMultiplier, setSizeMultiplier] = useState(1);
  const [backgroundColor, setBackgroundColor] = useState('#FFFFFF');

  const [strokes, setStrokes] = useState<PaintStroke[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<PaintStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<PaintStroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [title, setTitle] = useState('');

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvasSize.width / rect.width;
      const scaleY = canvasSize.height / rect.height;

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
    [canvasSize],
  );

  const redraw = useCallback(
    (strokeList: PaintStroke[], activeStroke?: PaintStroke | null) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      const allStrokes = activeStroke
        ? [...strokeList, activeStroke]
        : strokeList;

      for (const stroke of allStrokes) {
        const settings = TOOL_SETTINGS[stroke.tool];
        if (!settings) continue;

        ctx.globalAlpha = stroke.opacity;
        ctx.globalCompositeOperation = settings.compositeOp;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.thickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (stroke.points.length < 2) continue;

        ctx.beginPath();
        const first = stroke.points[0]!;
        ctx.moveTo(first.x, first.y);

        // Smooth curve through points using quadratic bezier
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const current = stroke.points[i]!;
          const next = stroke.points[i + 1]!;
          const midX = (current.x + next.x) / 2;
          const midY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }

        // Last point
        const last = stroke.points[stroke.points.length - 1]!;
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    [canvasSize, backgroundColor],
  );

  useEffect(() => {
    redraw(strokes);
  }, [strokes, redraw]);

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const point = getCanvasPoint(e);
      const settings = TOOL_SETTINGS[tool]!;

      const newStroke: PaintStroke = {
        id: `paint-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        tool,
        color: tool === 'eraser' ? '#000000' : color,
        thickness: settings.baseThickness * sizeMultiplier,
        opacity: settings.opacity,
        points: [point],
      };

      setCurrentStroke(newStroke);
      setIsDrawing(true);
    },
    [tool, color, sizeMultiplier, getCanvasPoint],
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      if (!isDrawing || !currentStroke) return;
      const point = getCanvasPoint(e);
      const updated = {
        ...currentStroke,
        points: [...currentStroke.points, point],
      };
      setCurrentStroke(updated);
      redraw(strokes, updated);
    },
    [isDrawing, currentStroke, getCanvasPoint, strokes, redraw],
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    if (currentStroke.points.length >= 2) {
      setStrokes((prev) => [...prev, currentStroke]);
      setUndoneStrokes([]);
    }
    setCurrentStroke(null);
  }, [isDrawing, currentStroke]);

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
    a.download = `painting-${title || Date.now()}.png`;
    a.click();
  }, [title]);

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

  const toolButtons: { id: PaintTool; icon: typeof Pen; label: string }[] = [
    { id: 'brush', icon: Paintbrush, label: 'Brush' },
    { id: 'pen', icon: Pen, label: 'Pen' },
    { id: 'marker', icon: Highlighter, label: 'Marker' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Top bar with title */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled painting..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
        />
        <Button variant="outline" size="sm" onClick={exportAsPng}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex gap-3">
        {/* Left toolbar */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 self-start">
          {/* Tool buttons */}
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

          <div className="border-t border-border my-1" />

          {/* Actions */}
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-30 transition-colors"
            title="Undo"
          >
            <Undo className="h-5 w-5" />
          </button>
          <button
            onClick={redo}
            disabled={undoneStrokes.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <Redo className="h-5 w-5" />
          </button>
          <button
            onClick={clear}
            disabled={strokes.length === 0}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-error disabled:opacity-30 transition-colors"
            title="Clear all"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative rounded-xl border border-border overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            className="w-full cursor-crosshair touch-none"
            style={{ aspectRatio: `${canvasSize.width}/${canvasSize.height}` }}
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

      {/* Bottom bar — color palette + size */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-2">
        {/* Color palette */}
        <div className="flex flex-wrap items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-all',
                color === c
                  ? 'border-primary scale-110 shadow-sm'
                  : 'border-transparent hover:border-primary/40',
              )}
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>

        <div className="border-l border-border h-8 mx-1" />

        {/* Size slider */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Size</span>
          <input
            type="range"
            min="0.25"
            max="5"
            step="0.25"
            value={sizeMultiplier}
            onChange={(e) => setSizeMultiplier(Number(e.target.value))}
            className="w-28 accent-primary"
          />
          <div
            className="rounded-full bg-text"
            style={{
              width: `${Math.max(4, TOOL_SETTINGS[tool]!.baseThickness * sizeMultiplier * 0.5)}px`,
              height: `${Math.max(4, TOOL_SETTINGS[tool]!.baseThickness * sizeMultiplier * 0.5)}px`,
            }}
          />
        </div>

        <div className="border-l border-border h-8 mx-1" />

        {/* Background color */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">BG</span>
          <input
            type="color"
            value={backgroundColor}
            onChange={(e) => setBackgroundColor(e.target.value)}
            className="h-7 w-7 rounded border border-border cursor-pointer"
          />
        </div>

        {/* Stroke count */}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-text-muted">
          <Layers className="h-3.5 w-3.5" />
          {strokes.length} strokes
        </div>
      </div>
    </div>
  );
}
