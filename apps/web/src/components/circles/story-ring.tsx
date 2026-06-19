'use client';

// StoryRing — a horizontal, Instagram-style avatar tray of story rings.
// - Leading "Your story" tile: a + add button that opens AddStorySheet.
// - Each followed/own circle with active stories renders an avatar with a
//   gradient ring when it has unseen stories, or a muted ring when all seen.
// - Tapping a ring opens the fullscreen StoryViewer starting at that tray.
// Self-contained: fetches the tray via circles-api and listens for realtime
// circle:story:new / circle:self:updated to keep itself fresh.

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import * as circlesApi from '@/lib/circles-api';
import { AddStorySheet } from './add-story-sheet';
import { StoryViewer } from './story-viewer';
import type { StoryTray, Story } from './types';

interface StoryRingProps {
  className?: string;
}

export function StoryRing({ className }: StoryRingProps) {
  const couple = useAuthStore((s) => s.couple);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  const [trays, setTrays] = useState<StoryTray[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  // Index into `trays` for the viewer; null = closed.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const loadTray = useCallback(async () => {
    try {
      const { trays: next } = await circlesApi.getStoryTray();
      setTrays(next);
    } catch {
      // Non-fatal: leave whatever we have (the rest of the page still works).
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTray();
  }, [loadTray]);

  // Realtime: a new story from a followed/own circle, or our own circle's
  // avatar/name changing, both warrant a tray refresh.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => void loadTray();
    socket.on('circle:story:new', refresh);
    socket.on('circle:self:updated', refresh);
    return () => {
      socket.off('circle:story:new', refresh);
      socket.off('circle:self:updated', refresh);
    };
  }, [loadTray, accessToken]);

  // MY couple's own circle id (if our circle has any active stories in the
  // tray). Passed to the viewer so it can surface the owner "Seen by N" panel.
  const ownTray = couple?.id
    ? trays.find((t) => isOwnTray(t, couple.id))
    : undefined;
  const ownCircleId = ownTray?.circle.id ?? null;

  const handleAdded = (_story: Story) => {
    // Refetch so the freshly added story groups correctly (own-first ordering).
    void loadTray();
  };

  // Optimistically drop a tray's ring to "seen" once all of its stories have
  // been viewed, so the gradient fades without waiting for a refetch.
  const handleStoryViewed = (story: Story) => {
    setTrays((prev) =>
      prev.map((t) => {
        if (t.circle.id !== story.circleId) return t;
        const stories = t.stories.map((s) =>
          s.id === story.id ? { ...s, viewedByMe: true } : s,
        );
        // The tray serializer omits `viewedByMe` for unseen stories (returns
        // undefined), so anything not strictly `true` is still unseen.
        const hasUnseen = stories.some((s) => s.viewedByMe !== true);
        return { ...t, stories, hasUnseen };
      }),
    );
  };

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-4 overflow-x-auto px-1 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
          className,
        )}
      >
        {/* Leading "Your story" add tile */}
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 focus:outline-none"
          aria-label="Add to your story"
        >
          <span className="relative inline-flex h-[64px] w-[64px] items-center justify-center rounded-full border-2 border-dashed border-border bg-surface transition-colors hover:border-border-focus">
            <Avatar
              size="lg"
              src={ownAvatar(trays, couple?.id)}
              name={couple?.coupleName || 'You'}
              className="h-[54px] w-[54px]"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface bg-primary text-text-on-primary">
              <Plus className="h-3 w-3" strokeWidth={3} />
            </span>
          </span>
          <span className="max-w-[68px] truncate text-center text-xs text-text-muted">
            Your story
          </span>
        </button>

        {loading && trays.length === 0 ? (
          <div className="flex items-center gap-2 px-2 text-text-muted">
            <Spinner size="sm" />
          </div>
        ) : (
          trays.map((tray, i) => {
            // Render every tray, own included, so you can re-watch your story.
            const isOwn = couple?.id ? isOwnTray(tray, couple.id) : false;
            return (
              <button
                key={tray.circle.id}
                type="button"
                onClick={() => setViewerIndex(i)}
                className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 focus:outline-none"
                aria-label={`View ${tray.circle.name}'s story`}
              >
                <span
                  className={cn(
                    'inline-flex h-[64px] w-[64px] items-center justify-center rounded-full p-[2.5px] transition-transform active:scale-95',
                    tray.hasUnseen
                      ? 'bg-gradient-to-tr from-primary via-secondary to-accent'
                      : 'bg-border',
                  )}
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-surface bg-surface">
                    <Avatar
                      size="lg"
                      src={tray.circle.avatarUrl}
                      name={tray.circle.name}
                      className="h-[52px] w-[52px]"
                    />
                  </span>
                </span>
                <span
                  className={cn(
                    'max-w-[68px] truncate text-center text-xs',
                    tray.hasUnseen
                      ? 'font-medium text-text'
                      : 'text-text-muted',
                  )}
                >
                  {isOwn ? 'Your story' : tray.circle.handle ? `@${tray.circle.handle}` : tray.circle.name}
                </span>
              </button>
            );
          })
        )}
      </div>

      <AddStorySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />

      {viewerIndex !== null && trays.length > 0 && (
        <StoryViewer
          trays={trays}
          startTrayIndex={viewerIndex}
          ownerCircleId={ownCircleId}
          onClose={() => setViewerIndex(null)}
          onStoryViewed={handleStoryViewed}
        />
      )}
    </>
  );
}

/** True when a tray belongs to MY couple's circle. */
function isOwnTray(tray: StoryTray, coupleId: string): boolean {
  // The tray summary doesn't carry coupleId, but its stories do.
  return tray.stories.some((s) => s.coupleId === coupleId);
}

/** Pick the avatar to show on the "Your story" tile (prefer own tray avatar). */
function ownAvatar(trays: StoryTray[], coupleId?: string): string | undefined {
  if (!coupleId) return undefined;
  const own = trays.find((t) => isOwnTray(t, coupleId));
  return own?.circle.avatarUrl;
}
