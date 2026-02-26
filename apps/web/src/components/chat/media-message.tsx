'use client';

import { useState } from 'react';
import { Play, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';

interface MediaMessageProps {
  /** Array of media URLs attached to a message */
  mediaUrls: string[];
  /** Whether this message was sent by the current user */
  isSent: boolean;
  /** Click handler to open full viewer */
  onImageClick?: (url: string, index: number) => void;
}

/**
 * Renders media attachments (images/videos) within a chat message bubble.
 * Supports single image, 2-image side-by-side, and 3+ grid layouts.
 */
export function MediaMessage({ mediaUrls, isSent, onImageClick }: MediaMessageProps) {
  if (!mediaUrls || mediaUrls.length === 0) return null;

  const isVideo = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    return ext === 'mp4' || ext === 'webm' || ext === 'mov';
  };

  // Single media
  if (mediaUrls.length === 1) {
    const url = mediaUrls[0]!;
    if (isVideo(url)) {
      return (
        <div className="relative max-w-xs rounded-lg overflow-hidden">
          <video
            src={url}
            controls
            preload="metadata"
            className="w-full rounded-lg"
          />
        </div>
      );
    }

    return (
      <div
        className="relative max-w-xs cursor-pointer rounded-lg overflow-hidden"
        onClick={() => onImageClick?.(url, 0)}
      >
        <img
          src={url}
          alt="Shared photo"
          className="w-full rounded-lg transition-opacity hover:opacity-90"
          loading="lazy"
        />
      </div>
    );
  }

  // Two media — side by side
  if (mediaUrls.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 max-w-xs rounded-lg overflow-hidden">
        {mediaUrls.map((url, index) => (
          <MediaThumb
            key={url}
            url={url}
            isVideoFile={isVideo(url)}
            onClick={() => onImageClick?.(url, index)}
          />
        ))}
      </div>
    );
  }

  // Three or more — grid
  return (
    <div className="grid grid-cols-2 gap-1 max-w-xs rounded-lg overflow-hidden">
      {mediaUrls.slice(0, 4).map((url, index) => (
        <div key={url} className="relative">
          <MediaThumb
            url={url}
            isVideoFile={isVideo(url)}
            onClick={() => onImageClick?.(url, index)}
          />
          {/* "+N more" overlay on last tile */}
          {index === 3 && mediaUrls.length > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <span className="text-white font-semibold text-lg">
                +{mediaUrls.length - 4}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MediaThumb({
  url,
  isVideoFile,
  onClick,
}: {
  url: string;
  isVideoFile: boolean;
  onClick?: () => void;
}) {
  if (isVideoFile) {
    return (
      <div className="relative aspect-square cursor-pointer" onClick={onClick}>
        <video
          src={url}
          muted
          preload="metadata"
          className="h-full w-full object-cover rounded-lg"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white">
            <Play className="h-4 w-4 ml-0.5" fill="white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square cursor-pointer" onClick={onClick}>
      <img
        src={url}
        alt="Shared photo"
        className="h-full w-full object-cover rounded-lg transition-opacity hover:opacity-90"
        loading="lazy"
      />
    </div>
  );
}

export type { MediaMessageProps };
