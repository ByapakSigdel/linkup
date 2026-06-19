'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Pencil, Sparkles, Eraser, Trash2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Input, Card } from '@/components/ui';

type CreateMode = 'upload' | 'draw';

const DRAW_COLORS = [
  '#E8E4DC', '#C4A8E0', '#D4A574', '#A8BFD4',
  '#F06595', '#FF6B6B', '#FFD93D', '#51CF66',
  '#339AF0', '#845EF7', '#FF9500', '#1A1B2E',
];

const CANVAS_SIZE = 256;

export interface NewEmojiPayload {
  name: string;
  image: string;
  category?: string;
  isAnimated?: boolean;
}

interface EmojiCreatorProps {
  onCreate: (payload: NewEmojiPayload) => Promise<void>;
}

export function EmojiCreator({ onCreate }: EmojiCreatorProps) {
  const [mode, setMode] = useState<CreateMode>('upload');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  // Upload state
  const [uploadDataUrl, setUploadDataUrl] = useState<string | null>(null);
  const [uploadIsAnimated, setUploadIsAnimated] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Draw state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawColor, setDrawColor] = useState('#C4A8E0');
  const [brushSize, setBrushSize] = useState(12);
  const [isErasing, setIsErasing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const sanitizedName = name.trim().replace(/[\s:]+/g, '_').toLowerCase();

  // ---- Upload handling ----
  const handleFile = useCallback((file: File) => {
    setUploadError(undefined);
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Use a PNG, JPEG, GIF, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('Image must be under 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadDataUrl(reader.result as string);
      setUploadIsAnimated(file.type === 'image/gif');
    };
    reader.onerror = () => setUploadError('Could not read that file.');
    reader.readAsDataURL(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // ---- Canvas drawing ----
  const getCanvasPoint = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scale = CANVAS_SIZE / rect.width;
      let clientX: number, clientY: number;
      if ('touches' in e) {
        const t = e.touches[0];
        if (!t) return lastPointRef.current ?? { x: 0, y: 0 };
        clientX = t.clientX;
        clientY = t.clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: (clientX - rect.left) * scale,
        y: (clientY - rect.top) * scale,
      };
    },
    [],
  );

  const startDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      const point = getCanvasPoint(e);
      lastPointRef.current = point;
      // Draw a dot so a single tap registers
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = isErasing
          ? 'destination-out'
          : 'source-over';
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      setHasDrawn(true);
    },
    [getCanvasPoint, drawColor, brushSize, isErasing],
  );

  const moveDraw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const ctx = canvasRef.current?.getContext('2d');
      const last = lastPointRef.current;
      if (!ctx || !last) return;
      const point = getCanvasPoint(e);
      ctx.globalCompositeOperation = isErasing
        ? 'destination-out'
        : 'source-over';
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
    },
    [getCanvasPoint, drawColor, brushSize, isErasing],
  );

  const endDraw = useCallback(() => {
    drawingRef.current = false;
    lastPointRef.current = null;
  }, []);

  const clearCanvas = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setHasDrawn(false);
  }, []);

  // ---- Submit ----
  const resetForm = () => {
    setName('');
    setCategory('');
    setNameError(undefined);
    setUploadDataUrl(null);
    setUploadIsAnimated(false);
    setUploadError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearCanvas();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your emoji a name.');
      return;
    }
    if (trimmed.length > 50) {
      setNameError('Name must be 50 characters or fewer.');
      return;
    }
    setNameError(undefined);

    let image: string | null = null;
    let isAnimated = false;

    if (mode === 'upload') {
      if (!uploadDataUrl) {
        setUploadError('Choose an image first.');
        return;
      }
      image = uploadDataUrl;
      isAnimated = uploadIsAnimated;
    } else {
      if (!hasDrawn) {
        setUploadError('Draw something first.');
        return;
      }
      image = canvasRef.current?.toDataURL('image/png') ?? null;
    }

    if (!image) return;

    setSubmitting(true);
    try {
      await onCreate({
        name: sanitizedName || trimmed,
        image,
        category: category.trim() || undefined,
        isAnimated,
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card cardStyle="bordered" padding="md" className="rounded-2xl">
      {/* Mode toggle */}
      <div className="mb-4 inline-flex rounded-xl border border-border bg-background p-1">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            mode === 'upload'
              ? 'bg-primary text-text-on-primary shadow-sm'
              : 'text-text-muted hover:text-text',
          )}
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setMode('draw')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            mode === 'draw'
              ? 'bg-primary text-text-on-primary shadow-sm'
              : 'text-text-muted hover:text-text',
          )}
        >
          <Pencil className="h-4 w-4" />
          Draw
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        {/* Left: creation surface */}
        <div className="flex flex-col items-center gap-3">
          {mode === 'upload' ? (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'group relative flex h-40 w-40 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-surface-hover',
                  uploadDataUrl && 'border-solid border-border',
                )}
              >
                {uploadDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={uploadDataUrl}
                    alt="Emoji preview"
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-text-muted group-hover:text-primary" />
                    <span className="px-3 text-center text-xs text-text-muted">
                      Click to choose an image
                    </span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={onFileChange}
                className="hidden"
              />
              {uploadDataUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setUploadDataUrl(null);
                    setUploadIsAnimated(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border border-border bg-[#0d0e1a]">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  className="h-40 w-40 cursor-crosshair touch-none"
                  onMouseDown={startDraw}
                  onMouseMove={moveDraw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={moveDraw}
                  onTouchEnd={endDraw}
                />
              </div>

              {/* Palette */}
              <div className="flex max-w-[10rem] flex-wrap items-center justify-center gap-1.5">
                {DRAW_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setDrawColor(c);
                      setIsErasing(false);
                    }}
                    className={cn(
                      'h-6 w-6 rounded-full border-2 transition-all',
                      drawColor === c && !isErasing
                        ? 'border-primary scale-110'
                        : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>

              {/* Brush controls */}
              <div className="flex w-full items-center gap-2">
                <span className="text-xs text-text-muted">Size</span>
                <input
                  type="range"
                  min={2}
                  max={40}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <button
                  type="button"
                  onClick={() => setIsErasing((v) => !v)}
                  title="Eraser"
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                    isErasing
                      ? 'bg-primary text-text-on-primary'
                      : 'text-text-muted hover:bg-surface-hover hover:text-text',
                  )}
                >
                  <Eraser className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clearCanvas}
                  title="Clear"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-error"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
          {uploadError && (
            <p className="text-center text-xs text-error">{uploadError}</p>
          )}
        </div>

        {/* Right: details */}
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            placeholder="happy_cat"
            value={name}
            maxLength={50}
            error={nameError}
            onChange={(e) => setName(e.target.value)}
            helperText={
              sanitizedName
                ? `Used as :${sanitizedName}:`
                : 'Letters, numbers and underscores'
            }
          />
          <Input
            label="Category (optional)"
            placeholder="reactions"
            value={category}
            maxLength={30}
            onChange={(e) => setCategory(e.target.value)}
          />

          {mode === 'upload' && uploadIsAnimated && (
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <Sparkles className="h-3.5 w-3.5" />
              Animated GIF detected
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="mt-auto self-start"
          >
            <Sparkles className="h-4 w-4" />
            Create emoji
          </Button>
        </div>
      </div>
    </Card>
  );
}
