'use client';

import { Palette } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { PaintCanvas } from '@/components/creative';

export default function PaintPage() {
  const couple = useAuthStore((s) => s.couple);

  if (!couple?.isPaired) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-active mb-4">
          <Palette className="h-7 w-7 text-text-muted" />
        </div>
        <h2 className="text-lg font-semibold text-text">Paint together</h2>
        <p className="mt-1 text-sm text-text-muted max-w-sm">
          Link up with your partner to start creating paintings together.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text">Paint</h1>
        <p className="text-sm text-text-muted">
          Create beautiful paintings with brushes, pens, and markers
        </p>
      </div>

      <PaintCanvas />
    </div>
  );
}
