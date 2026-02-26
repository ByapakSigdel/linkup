'use client';

import { useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { ScribbleCanvas } from '@/components/creative';

export default function ScribblePage() {
  const couple = useAuthStore((s) => s.couple);

  const handleSend = useCallback(
    (dataUrl: string) => {
      // For now, download the scribble. In the future, this will
      // send it as a message via the chat WebSocket.
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `scribble-${Date.now()}.png`;
      a.click();
    },
    [],
  );

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-active mb-4">
          <Pencil className="h-7 w-7 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text">Scribble together</h2>
        <p className="mt-1 text-sm text-text-muted max-w-sm">
          Link up with your partner to start doodling and sharing scribbles.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Scribble</h1>
        <p className="text-sm text-text-muted">
          Draw something and send it to your partner
        </p>
      </div>

      <ScribbleCanvas onSend={handleSend} />
    </div>
  );
}
