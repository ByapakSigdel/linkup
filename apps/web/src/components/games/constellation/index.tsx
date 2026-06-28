'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Spinner } from '@/components/ui';
import { getSocket } from '@/lib/socket';
import { useAuthStore, isActivelyPaired } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';

import { SkyView } from './sky-view';
import { PromptSheet } from './prompt-sheet';
import { StarDetail } from './star-detail';
import { dailyPrompt, CONSTELLATIONS, promptsFor } from './deck';
import type { Star } from './types';

export function ConstellationOfUs({ readOnly: readOnlyProp }: { readOnly?: boolean } = {}) {
  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  // Read-only memorial mode: the sky can be wandered but no new stars are lit
  // and existing ones can't be edited. Defaults to the store-derived gate so a
  // surviving partner viewing an ended couple is read-only everywhere.
  const readOnly = readOnlyProp ?? !isActivelyPaired({ user, couple });
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
  // NOTE: when readOnly=true (the memorial), `couple` on the auth store is
  // expected to be the ARCHIVED couple (the auth hydrate loads it via the
  // survivor's archivedCoupleId). fetchStars() resolves the couple id from that
  // same store, so the backend /constellation read must authorize archived-couple
  // membership (user.archivedCoupleId === coupleId) in addition to active
  // membership, or a now-solo survivor's star-fetch will silently fail.
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

  // Defensive: unpaired guard (the route also handles this, but keep a light
  // check). In read-only memorial mode the couple is ended (isPaired false), so
  // skip this guard there — the memorial still wants to render the archived sky.
  if (!readOnly && !couple?.isPaired) {
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

  const hasStars = stars.length > 0;

  return (
    <div className="flex h-[70vh] min-h-[28rem] flex-col">
      {/* Progress header — only once the sky has begun. */}
      {hasStars && (
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs text-text-muted">
            <span className="text-primary">✦ </span>
            <span className="font-display text-sm font-semibold text-text">{litCount}</span>
            {` ${litCount === 1 ? 'star' : 'stars'} lit · `}
            <span className="font-display text-sm font-semibold text-text">{completeCount}</span>
            {` ${completeCount === 1 ? 'constellation' : 'constellations'}`}
            {pct > 0 ? ` · you know each other ${pct}%` : ''}
          </p>
        </div>
      )}

      {/* Sky (always present so the empty state floats over the dust + pending field) */}
      <div className="relative flex-1">
        <SkyView
          stars={stars}
          onPressStar={setSelected}
          onPressEmpty={readOnly ? undefined : () => setSheetOpen(true)}
        />

        {/* Empty-state invitation, centered over the faint pending field. */}
        {!hasStars && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="pointer-events-auto flex max-w-xs flex-col items-center text-center">
              <p className="font-display text-2xl leading-snug text-text">
                {readOnly ? 'A quiet sky.' : 'Your sky is dark — for now.'}
              </p>
              <p className="mt-2 mb-6 text-sm text-text-muted">
                {readOnly
                  ? 'No stars were lit between you.'
                  : 'Answer a prompt to light your first star.'}
              </p>
              {!readOnly && (
                <Button variant="primary" shape="pill" onClick={() => setSheetOpen(true)}>
                  ✦ Light your first star
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating CTA — hidden in the empty state (the invitation carries the
          CTA) and in read-only memorial mode (the sky is frozen). */}
      {hasStars && !readOnly && (
        <div className="p-4 pb-6">
          <Button variant="primary" shape="pill" onClick={() => setSheetOpen(true)}>
            ✦ Light a new star
          </Button>
        </div>
      )}

      {/* Prompt sheet — never reachable in read-only mode (the CTAs that open it
          are hidden), but guard the render too. */}
      {!readOnly && (
        <PromptSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          dailyPrompt={daily}
        />
      )}

      {/* Star detail */}
      {selected && (
        <StarDetail star={selected} onClose={() => setSelected(null)} readOnly={readOnly} />
      )}
    </div>
  );
}
