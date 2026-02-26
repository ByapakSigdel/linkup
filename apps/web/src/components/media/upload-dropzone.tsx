'use client';

import { useCallback, useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Film, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, Spinner } from '@/components/ui';
import { useMediaStore, type MediaItem } from '@/stores/media-store';

interface UploadDropzoneProps {
  coupleId: string;
  albumId?: string;
  onUploadComplete?: (media: MediaItem) => void;
  className?: string;
  compact?: boolean;
}

const ACCEPTED_TYPES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'],
  'video/*': ['.mp4', '.webm', '.mov'],
};

const ACCEPTED_EXTENSIONS = Object.values(ACCEPTED_TYPES).flat();

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDropzone({
  coupleId,
  albumId,
  onUploadComplete,
  className,
  compact = false,
}: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useMediaStore((s) => s.uploadFile);
  const uploads = useMediaStore((s) => s.uploads);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, 50); // max 50 per batch

      // Generate previews for images
      const newPreviews = fileArray
        .filter((f) => f.type.startsWith('image/'))
        .map((file) => ({
          file,
          url: URL.createObjectURL(file),
        }));
      setPreviews((prev) => [...prev, ...newPreviews]);

      // Upload each file
      for (const file of fileArray) {
        const result = await uploadFile(coupleId, file, { albumId });
        if (result && onUploadComplete) {
          onUploadComplete(result);
        }
      }

      // Clean up previews after all uploads
      setTimeout(() => {
        newPreviews.forEach((p) => URL.revokeObjectURL(p.url));
        setPreviews([]);
      }, 3000);
    },
    [coupleId, albumId, uploadFile, onUploadComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFiles],
  );

  const removePreview = useCallback((index: number) => {
    setPreviews((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const activeUploads = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'pending',
  );

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_TYPES).join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={activeUploads.length > 0}
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        {activeUploads.length > 0 && (
          <span className="text-xs text-text-muted">
            Uploading {activeUploads.length} file(s)...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer',
          isDragging
            ? 'border-primary bg-primary-light scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-surface-hover',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={Object.keys(ACCEPTED_TYPES).join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
            isDragging ? 'bg-primary text-text-on-primary' : 'bg-surface-active text-text-muted',
          )}
        >
          <Upload className="h-6 w-6" />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-text">
            {isDragging ? 'Drop files here' : 'Drag & drop files or click to browse'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Photos up to 100MB, Videos up to 500MB. Max 50 files at once.
          </p>
        </div>

        <div className="flex items-center gap-3 text-text-muted">
          <div className="flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            <span className="text-xs">Photos</span>
          </div>
          <div className="flex items-center gap-1">
            <Film className="h-3.5 w-3.5" />
            <span className="text-xs">Videos</span>
          </div>
        </div>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
            >
              {upload.status === 'uploading' && <Spinner size="sm" />}
              {upload.status === 'complete' && (
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
              )}
              {upload.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-error shrink-0" />
              )}
              {upload.status === 'pending' && (
                <FileText className="h-4 w-4 text-text-muted shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-text">
                  {upload.file.name}
                </p>
                <p className="text-xs text-text-muted">
                  {formatFileSize(upload.file.size)}
                  {upload.status === 'uploading' && ` · ${upload.progress}%`}
                  {upload.status === 'error' && ` · ${upload.error}`}
                </p>
              </div>

              {upload.status === 'uploading' && (
                <div className="w-20 h-1.5 bg-surface-active rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((preview, index) => (
            <div key={preview.url} className="relative aspect-square rounded-lg overflow-hidden">
              <img
                src={preview.url}
                alt={preview.file.name}
                className="h-full w-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removePreview(index);
                }}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
