// StoryRing — a horizontal, Instagram-style avatar tray of story rings. Ported
// from apps/web/src/components/circles/story-ring.tsx.
// - Leading "Your story" tile opens AddStorySheet.
// - Each circle with active stories shows a gradient ring (unseen) or muted ring
//   (all seen). Tapping opens the StoryViewer at that tray.
// Self-contained: fetches the tray + listens for circle:story:new /
// circle:self:updated to stay fresh.

import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { Avatar, AppText, Spinner } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth-store';
import * as circlesApi from '@/lib/circles-api';
import { AddStorySheet } from './add-story-sheet';
import { StoryViewer } from './story-viewer';
import type { StoryTray, Story } from './types';

export function StoryRing() {
  const { colors } = useTheme();
  const couple = useAuthStore((s) => s.couple);

  const [trays, setTrays] = useState<StoryTray[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const loadTray = useCallback(async () => {
    try {
      const { trays: next } = await circlesApi.getStoryTray();
      setTrays(next);
    } catch {
      // Non-fatal.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTray();
  }, [loadTray]);

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
  }, [loadTray]);

  const ownTray = couple?.id ? trays.find((t) => isOwnTray(t, couple.id)) : undefined;
  const ownCircleId = ownTray?.circle.id ?? null;

  const handleAdded = (_story: Story) => {
    void loadTray();
  };

  const handleStoryViewed = (story: Story) => {
    setTrays((prev) =>
      prev.map((t) => {
        if (t.circle.id !== story.circleId) return t;
        const stories = t.stories.map((s) => (s.id === story.id ? { ...s, viewedByMe: true } : s));
        const hasUnseen = stories.some((s) => s.viewedByMe !== true);
        return { ...t, stories, hasUnseen };
      }),
    );
  };

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingVertical: 12, paddingHorizontal: 4 }}
      >
        {/* Leading "Your story" add tile */}
        <Pressable onPress={() => setAddOpen(true)} style={{ width: 68, alignItems: 'center', gap: 6 }} accessibilityLabel="Add to your story">
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Avatar uri={resolveMediaUrl(ownTray?.circle.avatarUrl)} name={couple?.coupleName || 'You'} size={54} />
            <View
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: colors.primary,
                borderWidth: 2,
                borderColor: colors.background,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Plus size={12} color={colors.textOnPrimary} strokeWidth={3} />
            </View>
          </View>
          <AppText variant="caption" muted numberOfLines={1} style={{ maxWidth: 68, textAlign: 'center' }}>
            Your story
          </AppText>
        </Pressable>

        {loading && trays.length === 0 ? (
          <View style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
            <Spinner size="small" />
          </View>
        ) : (
          trays.map((tray, i) => {
            const isOwn = couple?.id ? isOwnTray(tray, couple.id) : false;
            const label = isOwn ? 'Your story' : tray.circle.handle ? `@${tray.circle.handle}` : tray.circle.name;
            return (
              <Pressable
                key={tray.circle.id}
                onPress={() => setViewerIndex(i)}
                style={{ width: 68, alignItems: 'center', gap: 6 }}
                accessibilityLabel={`View ${tray.circle.name}'s story`}
              >
                {tray.hasUnseen ? (
                  <LinearGradient
                    colors={[colors.primary, colors.secondary, colors.accent]}
                    start={{ x: 0, y: 1 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: 64, height: 64, borderRadius: 32, padding: 2.5, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <View style={{ width: '100%', height: '100%', borderRadius: 30, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Avatar uri={resolveMediaUrl(tray.circle.avatarUrl)} name={tray.circle.name} size={52} />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2.5, backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: '100%', height: '100%', borderRadius: 30, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Avatar uri={resolveMediaUrl(tray.circle.avatarUrl)} name={tray.circle.name} size={52} />
                    </View>
                  </View>
                )}
                <AppText
                  variant="caption"
                  muted={!tray.hasUnseen}
                  weight={tray.hasUnseen ? '600' : '400'}
                  numberOfLines={1}
                  style={{ maxWidth: 68, textAlign: 'center' }}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <AddStorySheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={handleAdded} />

      {viewerIndex !== null && trays.length > 0 ? (
        <StoryViewer
          trays={trays}
          startTrayIndex={viewerIndex}
          ownerCircleId={ownCircleId}
          onClose={() => setViewerIndex(null)}
          onStoryViewed={handleStoryViewed}
        />
      ) : null}
    </>
  );
}

function isOwnTray(tray: StoryTray, coupleId: string): boolean {
  return tray.stories.some((s) => s.coupleId === coupleId);
}
