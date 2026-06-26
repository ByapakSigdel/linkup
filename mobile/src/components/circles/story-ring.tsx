// StoryRing — a horizontal, Instagram-style avatar tray of story rings. Ported
// from apps/web/src/components/circles/story-ring.tsx.
// - Leading "Your story" tile opens AddStorySheet.
// - Each circle with active stories shows a gradient ring (unseen) or muted ring
//   (all seen). Tapping opens the StoryViewer at that tray.
// Self-contained: fetches the tray + listens for circle:story:new /
// circle:self:updated to stay fresh.
//
// Avatar images use expo-image (memory-disk cache + recyclingKey) for the
// thumb (~256px) variant so small ring images are cheaply recycled.

import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Text } from 'react-native';
import { Image } from 'expo-image';
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

// ─── CircleAvatar ─────────────────────────────────────────────────────────────
// Inline avatar that uses expo-image for caching. Falls back to initials when no
// URL is available (mirrors the shared Avatar component's behaviour).
function CircleAvatar({
  uri,
  name,
  size,
  recyclingKey,
}: {
  uri?: string | null;
  name: string;
  size: number;
  recyclingKey: string;
}) {
  const { colors, fonts } = useTheme();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHover }}
      />
    );
  }
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.primary, fontFamily: fonts.bodyBold, fontSize: size * 0.36 }}>
        {initials}
      </Text>
    </View>
  );
}

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
        {/* Leading "Your story" add tile — use Avatar (initials fallback) */}
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
            // Resolve the thumb-variant URL for this circle's avatar.
            // CircleSummary carries avatarUrl (original); variants arrive via
            // future pipeline enrichment. For now resolveMediaUrl gives the CDN
            // URL we use as both the thumb fallback and the recyclingKey.
            const avatarUri = resolveMediaUrl(tray.circle.avatarUrl) ?? undefined;
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
                    <View style={{ width: '100%', height: '100%', borderRadius: 30, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <CircleAvatar
                        uri={avatarUri}
                        name={tray.circle.name}
                        size={52}
                        recyclingKey={`story-ring-${tray.circle.id}`}
                      />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2.5, backgroundColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: '100%', height: '100%', borderRadius: 30, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      <CircleAvatar
                        uri={avatarUri}
                        name={tray.circle.name}
                        size={52}
                        recyclingKey={`story-ring-${tray.circle.id}`}
                      />
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
