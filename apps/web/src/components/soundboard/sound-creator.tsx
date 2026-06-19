'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  Upload,
  Square,
  Play,
  Pause,
  Trash2,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Input, Card, Emoji } from '@/components/ui';

type AddMode = 'record' | 'upload';

const MAX_RECORD_SECONDS = 10;

const SWATCHES = [
  '#C4A8E0', // lilac
  '#D4A574', // amber
  '#A8BFD4', // periwinkle
  '#F06595', // pink
  '#FF6B6B', // coral
  '#51CF66', // green
  '#339AF0', // blue
  '#FFD93D', // yellow
];

export interface NewSoundPayload {
  name: string;
  audio: string;
  emoji?: string;
  category?: string;
  color?: string;
  duration?: number;
}

interface SoundCreatorProps {
  onCreate: (payload: NewSoundPayload) => Promise<void>;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function formatTime(s: number) {
  return `0:${String(Math.floor(s)).padStart(2, '0')}`;
}

export function SoundCreator({ onCreate }: SoundCreatorProps) {
  const [mode, setMode] = useState<AddMode>('record');

  // Shared form state
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [color, setColor] = useState(SWATCHES[0]!);
  const [nameError, setNameError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  // Audio result (used by both modes)
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string>();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Preview playback
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const teardownStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    stopTimer();
    setIsRecording(false);
  }, [stopTimer]);

  const startRecording = useCallback(async () => {
    setError(undefined);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError('Recording is not supported in this browser. Try uploading instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        teardownStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          try {
            const url = await blobToDataUrl(blob);
            setAudioDataUrl(url);
          } catch {
            setError('Could not process the recording.');
          }
        }
      };

      recorder.start();
      setIsRecording(true);
      setElapsed(0);
      setAudioDataUrl(null);
      setDuration(undefined);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 0.1;
          if (next >= MAX_RECORD_SECONDS) {
            stopRecording();
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 100);
    } catch {
      setError('Microphone access was denied.');
    }
  }, [stopRecording, teardownStream]);

  // Capture the recorded duration once recording ends.
  useEffect(() => {
    if (!isRecording && elapsed > 0 && audioDataUrl) {
      setDuration(Math.round(elapsed * 10) / 10);
    }
  }, [isRecording, elapsed, audioDataUrl]);

  const handleFile = useCallback((file: File) => {
    setError(undefined);
    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Audio must be under 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setAudioDataUrl(url);
      // Try to read duration via a temporary audio element.
      const probe = new Audio(url);
      probe.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(probe.duration)) {
          setDuration(Math.round(probe.duration * 10) / 10);
        }
      });
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsDataURL(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const togglePreview = useCallback(() => {
    if (!audioDataUrl) return;
    if (!previewRef.current) {
      previewRef.current = new Audio(audioDataUrl);
      previewRef.current.onended = () => setPreviewPlaying(false);
    } else if (previewRef.current.src !== audioDataUrl) {
      previewRef.current.src = audioDataUrl;
    }
    if (previewPlaying) {
      previewRef.current.pause();
      previewRef.current.currentTime = 0;
      setPreviewPlaying(false);
    } else {
      void previewRef.current.play();
      setPreviewPlaying(true);
    }
  }, [audioDataUrl, previewPlaying]);

  const clearAudio = useCallback(() => {
    previewRef.current?.pause();
    setPreviewPlaying(false);
    setAudioDataUrl(null);
    setDuration(undefined);
    setElapsed(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const switchMode = (next: AddMode) => {
    if (isRecording) stopRecording();
    clearAudio();
    setError(undefined);
    setMode(next);
  };

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      stopTimer();
      teardownStream();
      previewRef.current?.pause();
    };
  }, [stopTimer, teardownStream]);

  const resetForm = () => {
    setName('');
    setEmoji('');
    setColor(SWATCHES[0]!);
    setNameError(undefined);
    clearAudio();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your sound a name.');
      return;
    }
    if (trimmed.length > 50) {
      setNameError('Name must be 50 characters or fewer.');
      return;
    }
    if (!audioDataUrl) {
      setError(mode === 'record' ? 'Record something first.' : 'Choose an audio file first.');
      return;
    }
    setNameError(undefined);
    setSubmitting(true);
    try {
      await onCreate({
        name: trimmed,
        audio: audioDataUrl,
        emoji: emoji.trim() || undefined,
        color,
        duration,
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
          onClick={() => switchMode('record')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            mode === 'record'
              ? 'bg-primary text-text-on-primary shadow-sm'
              : 'text-text-muted hover:text-text',
          )}
        >
          <Mic className="h-4 w-4" />
          Record
        </button>
        <button
          type="button"
          onClick={() => switchMode('upload')}
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: capture */}
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-background p-6">
          {mode === 'record' ? (
            <>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={cn(
                  'flex h-20 w-20 items-center justify-center rounded-full text-white transition-all',
                  isRecording
                    ? 'bg-error shadow-lg animate-pulse'
                    : 'bg-primary hover:bg-primary-hover hover:scale-105 shadow-md',
                )}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? (
                  <Square className="h-7 w-7 fill-current" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </button>
              <div className="text-center">
                {isRecording ? (
                  <p className="font-mono text-sm text-error">
                    {formatTime(elapsed)} / {formatTime(MAX_RECORD_SECONDS)}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted">
                    {audioDataUrl
                      ? 'Recorded — preview below'
                      : `Tap to record (up to ${MAX_RECORD_SECONDS}s)`}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-hover text-text-muted transition-all hover:bg-surface-active hover:text-text hover:scale-105"
                aria-label="Choose audio file"
              >
                <Upload className="h-8 w-8" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={onFileChange}
                className="hidden"
              />
              <p className="text-center text-xs text-text-muted">
                {audioDataUrl ? 'Loaded — preview below' : 'Click to choose an audio file'}
              </p>
            </>
          )}

          {/* Preview controls */}
          {audioDataUrl && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={togglePreview}>
                {previewPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    Preview
                  </>
                )}
              </Button>
              {duration !== undefined && (
                <span className="font-mono text-xs text-text-muted">{duration}s</span>
              )}
              <Button variant="ghost" size="sm" onClick={clearAudio}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1 text-center text-xs text-error">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Right: details */}
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            placeholder="Air horn"
            value={name}
            maxLength={50}
            error={nameError}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Emoji (optional)"
                placeholder="📣"
                value={emoji}
                maxLength={4}
                onChange={(e) => setEmoji(e.target.value)}
                helperText="A single emoji shown on the pad"
              />
            </div>
            <div className="mb-7 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
              <Emoji emoji={emoji.trim() || '🔊'} size={26} label="Pad emoji preview" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Color</span>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-all',
                    color === c
                      ? 'border-text scale-110'
                      : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                  title={c}
                />
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="mt-auto self-start"
          >
            <Plus className="h-4 w-4" />
            Add sound
          </Button>
        </div>
      </div>
    </Card>
  );
}
