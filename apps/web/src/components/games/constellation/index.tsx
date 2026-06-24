'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';

import { SkyView } from './sky-view';
import { PromptSheet } from './prompt-sheet';
import { StarDetail } from './star-detail';
import { dailyPrompt, CONSTELLATIONS, promptsFor } from './deck';
import type { Star } from './types';

export function ConstellationOfUs() {
  const couple = useAuthStore((s) => s.couple);
  const stars = useConstellationStore((s) => s.stars);
  const loading = useConstellationStore((s) => s.loading);
  const fetchStars = useConstellationStore((s) => s.fetchStars);
  const litPromptKeys = useConstellationStore((s) => s.litPromptKeys);

  // Grab applyRemote via a stable ref so the socket listener doesn't thrash.
  const applyRemoteRef = useRef(useConstellationStore.getState().applyRemote);
  useEffect(() => {
    applyRemoteRef.current = useConstellationStore.getState().applyRemote;
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<Star | null>(null);

  // Fetch on mount.
  useEffect(() => {
    void fetchStars();
  }, [fetchStars]);

  // Subscribe to realtime constellation:star events.
  useEffect(() => {
    const handler = (star: Star) => applyRemoteRef.current(star);
    const socket = getSocket();
    socket?.on('constellation:star', handler);
    return () => {
      socket?.off('constellation:star', handler);
    };
  }, []);

  // Compute today's daily prompt (stable per coupleId + date).
  const daily = useMemo(
    () =>
      couple?.id
        ? dailyPrompt(
            couple.id,
            new Date().toISOString().slice(0, 10),
            litPromptKeys(),
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [couple?.id, stars],
  );

  // Progress counts.
  const litCount = useMemo(
    () => stars.filter((s) => s.status === 'lit').length,
    [stars],
  );

  const completeCount = useMemo(() => {
    const litKeys = new Set(
      stars.filter((s) => s.status === 'lit' && s.promptKey).map((s) => s.promptKey as string),
    );
    return CONSTELLATIONS.filter((c) => {
      const reqd = promptsFor(c.key).filter((p) => p.tier !== 'spicy');
      return reqd.length > 0 && reqd.every((p) => litKeys.has(p.key));
    }).length;
  }, [stars]);

  // Guess accuracy: matched / (matched + missed).
  const pct = useMemo(() => {
    const guessStars = stars.filter(
      (s) =>
        s.kind === 'guess' &&
        (s.answers as Record<string, unknown>).matched != null,
    );
    if (guessStars.length === 0) return 0;
    const matched = guessStars.filter(
      (s) => (s.answers as { matched?: boolean | null }).matched === true,
    ).length;
    return Math.round((matched / guessStars.length) * 100);
  }, [stars]);

  // Defensive: unpaired guard (the route also handles this, but keep a light check).
  if (!couple?.isPaired) {
    return (
      <div className="flex min-h-64 items-center justify-center p-6 text-center">
        <p className="text-base font-semibold text-text-muted">
          Link up to start your sky ✦
        </p>
      </div>
    );
  }

  // Loading state (first load only).
  if (loading && stars.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-[70vh] min-h-[28rem] flex-col">
      {/* Progress header */}
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-xs text-primary">
          {`✦ ${litCount} star${litCount === 1 ? '' : 's'} lit · ${completeCount} constellation${completeCount === 1 ? '' : 's'}`}
          {pct > 0 ? ` · you know each other ${pct}%` : ''}
        </p>
      </div>

      {/* Sky */}
      <div className="relative flex-1">
        <SkyView
          stars={stars}
          onPressStar={setSelected}
          onPressEmpty={() => setSheetOpen(true)}
        />
      </div>

      {/* Floating CTA */}
      <div className="p-4 pb-6">
        <Button variant="primary" shape="pill" onClick={() => setSheetOpen(true)}>
          ✦ Light a new star
        </Button>
      </div>

      {/* Prompt sheet */}
      <PromptSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        dailyPrompt={daily}
      />

      {/* Star detail */}
      {selected && (
        <StarDetail star={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
