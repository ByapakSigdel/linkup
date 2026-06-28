import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Spinner } from '@/components/ui';
import { useTheme } from '@/theme';
import { getSocket } from '@/lib/socket';
import { useAuthStore, isActivelyPaired } from '@/stores/auth-store';
import { useConstellationStore } from '@/stores/constellation-store';

import { SkyView } from './sky-view';
import { PromptSheet } from './prompt-sheet';
import { StarDetail } from './star-detail';
import { dailyPrompt, CONSTELLATIONS, promptsFor } from './deck';
import type { Star } from './types';

export function ConstellationOfUs({ readOnly: readOnlyProp }: { readOnly?: boolean } = {}): JSX.Element {
  const { colors } = useTheme();

  const user = useAuthStore((s) => s.user);
  const couple = useAuthStore((s) => s.couple);
  // Read-only memorial mode: the sky can be wandered but no new stars are lit
  // and existing ones can't be edited. Defaults to the store-derived gate.
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
      <View style={styles.centered}>
        <AppText variant="subtitle" style={{ textAlign: 'center', color: colors.textMuted }}>
          Link up to start your sky ✦
        </AppText>
      </View>
    );
  }

  // Loading state (first load only).
  if (loading && stars.length === 0) {
    return (
      <View style={styles.centered}>
        <Spinner />
      </View>
    );
  }

  const hasStars = stars.length > 0;

  return (
    <View style={styles.root}>
      {/* Progress header — only once the sky has begun. */}
      {hasStars && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <AppText variant="caption" color={colors.textMuted}>
            <AppText variant="caption" color={colors.primary}>
              {'✦ '}
            </AppText>
            <AppText variant="title" color={colors.text} style={styles.headerCount}>
              {litCount}
            </AppText>
            {` ${litCount === 1 ? 'star' : 'stars'} lit · `}
            <AppText variant="title" color={colors.text} style={styles.headerCount}>
              {completeCount}
            </AppText>
            {` ${completeCount === 1 ? 'constellation' : 'constellations'}`}
            {pct > 0 ? ` · you know each other ${pct}%` : ''}
          </AppText>
        </View>
      )}

      {/* Sky (always present so the empty state floats over the dust + pending field) */}
      <View style={styles.sky}>
        <SkyView
          stars={stars}
          onPressStar={setSelected}
          onPressEmpty={readOnly ? () => {} : () => setSheetOpen(true)}
        />

        {/* Empty-state invitation, centered over the faint pending field. */}
        {!hasStars && (
          <View pointerEvents="box-none" style={styles.emptyOverlay}>
            <View pointerEvents="box-none" style={styles.emptyCard}>
              <AppText variant="title" center color={colors.text} style={styles.emptyTitle}>
                {readOnly ? 'A quiet sky.' : 'Your sky is dark — for now.'}
              </AppText>
              <AppText variant="body" center color={colors.textMuted} style={styles.emptySub}>
                {readOnly
                  ? 'No stars were lit between you.'
                  : 'Answer a prompt to light your first star.'}
              </AppText>
              {readOnly ? null : (
                <Button label="✦ Light your first star" onPress={() => setSheetOpen(true)} />
              )}
            </View>
          </View>
        )}
      </View>

      {/* Floating CTA — hidden in the empty state (the invitation carries the CTA)
          and in read-only memorial mode (the sky is frozen). */}
      {hasStars && !readOnly && (
        <View style={styles.cta}>
          <Button label="✦ Light a new star" onPress={() => setSheetOpen(true)} />
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerCount: {
    fontSize: 15,
  },
  sky: {
    flex: 1,
  },
  cta: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyCard: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptySub: {
    marginBottom: 24,
  },
});
