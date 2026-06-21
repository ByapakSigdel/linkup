// StoryViewer — full-screen story viewer. Ported from
// apps/web/src/components/circles/story-viewer.tsx. Tap left/right thirds to page
// stories, tap middle to pause/resume, segmented auto-advancing progress bars,
// and an owner-only "Seen by" sheet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { X, Eye, Pause, Play } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  cancelAnimation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Avatar, AppText, Spinner, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import * as circlesApi from '@/lib/circles-api';
import { PostMedia } from './post-media';
import { timeAgo } from './helpers';
import type { Story, StoryTray, StoryViewer as StoryViewerUser } from './types';

const TAP_ZONE = 0.3;

interface StoryViewerProps {
  trays: StoryTray | StoryTray[];
  startTrayIndex?: number;
  startStoryIndex?: number;
  ownerCircleId?: string | null;
  onClose: () => void;
  onStoryViewed?: (story: Story) => void;
}

export function StoryViewer({
  trays,
  startTrayIndex = 0,
  startStoryIndex = 0,
  ownerCircleId,
  onClose,
  onStoryViewed,
}: StoryViewerProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const trayList = useMemo(() => (Array.isArray(trays) ? trays : [trays]), [trays]);

  const [trayIndex, setTrayIndex] = useState(() =>
    Math.min(Math.max(startTrayIndex, 0), Math.max(trayList.length - 1, 0)),
  );
  const [storyIndex, setStoryIndex] = useState(() => Math.max(startStoryIndex, 0));
  const [paused, setPaused] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);

  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerUser[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const progress = useSharedValue(0);
  const viewedRef = useRef<Set<string>>(new Set());

  const activeTray = trayList[trayIndex];
  const activeStory: Story | undefined = activeTray?.stories[storyIndex];
  const isVideo = (activeStory?.mediaType ?? 'image') === 'video';
  const isOwnerOfActive =
    !!ownerCircleId && !!activeStory && activeStory.circleId === ownerCircleId;

  const goToStory = useCallback((nextTray: number, nextStory: number) => {
    setTrayIndex(nextTray);
    setStoryIndex(nextStory);
    setViewersOpen(false);
    setPaused(false);
  }, []);

  const next = useCallback(() => {
    const tray = trayList[trayIndex];
    if (!tray) {
      onClose();
      return;
    }
    if (storyIndex < tray.stories.length - 1) {
      goToStory(trayIndex, storyIndex + 1);
    } else if (trayIndex < trayList.length - 1) {
      goToStory(trayIndex + 1, 0);
    } else {
      onClose();
    }
  }, [trayList, trayIndex, storyIndex, goToStory, onClose]);

  const prev = useCallback(() => {
    if (storyIndex > 0) {
      goToStory(trayIndex, storyIndex - 1);
    } else if (trayIndex > 0) {
      const prevTray = trayList[trayIndex - 1];
      goToStory(trayIndex - 1, Math.max((prevTray?.stories.length ?? 1) - 1, 0));
    } else {
      progress.value = 0;
    }
  }, [storyIndex, trayIndex, trayList, goToStory, progress]);

  // Record a view per segment (idempotent server-side).
  useEffect(() => {
    if (!activeStory) return;
    if (viewedRef.current.has(activeStory.id)) return;
    viewedRef.current.add(activeStory.id);
    let cancelled = false;
    circlesApi
      .viewStory(activeStory.id)
      .then(() => {
        if (!cancelled) onStoryViewed?.(activeStory);
      })
      .catch(() => {
        viewedRef.current.delete(activeStory.id);
      });
    return () => {
      cancelled = true;
    };
  }, [activeStory, onStoryViewed]);

  // Reset per-story local UI when the story changes.
  useEffect(() => {
    setImgLoading(activeStory ? !isVideo : false);
  }, [activeStory, isVideo]);

  // Progress / auto-advance loop (images). Videos auto-advance via expo-video.
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!activeStory || isVideo || imgLoading || paused) return;
    const duration = Math.max(activeStory.durationMs || 5000, 500);
    progress.value = withTiming(1, { duration }, (finished) => {
      if (finished) runOnJS(next)();
    });
    return () => {
      cancelAnimation(progress);
    };
  }, [activeStory, isVideo, imgLoading, paused, next, progress]);

  const openViewers = useCallback(() => {
    if (!activeStory) return;
    setViewersOpen(true);
    setPaused(true);
    setViewersLoading(true);
    circlesApi
      .getStoryViewers(activeStory.id)
      .then((res) => setViewers(res.viewers))
      .catch(() => setViewers([]))
      .finally(() => setViewersLoading(false));
  }, [activeStory]);

  const onTap = useCallback(
    (e: GestureResponderEvent) => {
      const relX = e.nativeEvent.locationX / width;
      if (relX < TAP_ZONE) prev();
      else if (relX > 1 - TAP_ZONE) next();
      else setPaused((p) => !p);
    },
    [width, prev, next],
  );

  if (!activeTray || !activeStory) return null;
  const circle = activeTray.circle;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Media + tap surface */}
        <Pressable style={{ flex: 1 }} onPress={onTap}>
          <PostMedia
            key={activeStory.id}
            url={activeStory.mediaUrl}
            resizeMode="contain"
            controls={false}
            autoplay={isVideo}
            onLoad={() => setImgLoading(false)}
          />
          {!isVideo && imgLoading ? (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Spinner size="large" color="#fff" />
            </View>
          ) : null}
        </Pressable>

        {/* Progress bars */}
        <Row gap={4} style={{ position: 'absolute', top: 48, left: 12, right: 12 }}>
          {activeTray.stories.map((s, i) => (
            <SegmentBar
              key={s.id}
              filled={i < storyIndex}
              active={i === storyIndex}
              progress={progress}
            />
          ))}
        </Row>

        {/* Header */}
        <Row gap={10} style={{ position: 'absolute', top: 62, left: 12, right: 12, alignItems: 'center' }}>
          <Avatar uri={resolveMediaUrl(circle.avatarUrl)} name={circle.name} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="label" color="#fff" numberOfLines={1}>
              {circle.handle ? `@${circle.handle}` : circle.name}
            </AppText>
            <AppText variant="caption" color="rgba(255,255,255,0.7)">
              {timeAgo(activeStory.createdAt)}
            </AppText>
          </View>
          <Pressable onPress={() => setPaused((p) => !p)} accessibilityLabel={paused ? 'Play' : 'Pause'} hitSlop={8}>
            {paused ? <Play size={22} color="#fff" /> : <Pause size={22} color="#fff" />}
          </Pressable>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={8}>
            <X size={24} color="#fff" />
          </Pressable>
        </Row>

        {/* Caption */}
        {activeStory.caption ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: isOwnerOfActive ? 56 : 28, paddingHorizontal: 16 }}>
            <AppText center color="#fff" style={{ fontSize: 15 }}>
              {activeStory.caption}
            </AppText>
          </View>
        ) : null}

        {/* Owner: Seen by N */}
        {isOwnerOfActive ? (
          <Pressable
            onPress={openViewers}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center' }}
          >
            <Row gap={6}>
              <Eye size={16} color="rgba(255,255,255,0.9)" />
              <AppText weight="600" color="rgba(255,255,255,0.9)" style={{ fontSize: 12 }}>
                Seen by {activeStory.viewCount}
              </AppText>
            </Row>
          </Pressable>
        ) : null}

        {/* Viewers sheet (owner) */}
        {viewersOpen ? (
          <View style={{ position: 'absolute', inset: 0, justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => setViewersOpen(false)}
              style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }}
            />
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 16,
                paddingBottom: 28,
                maxHeight: '70%',
              }}
            >
              <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                <Row gap={8}>
                  <Eye size={16} color={colors.textMuted} />
                  <AppText variant="label">Seen by {activeStory.viewCount}</AppText>
                </Row>
                <Pressable onPress={() => setViewersOpen(false)} accessibilityLabel="Close viewers" hitSlop={8}>
                  <X size={20} color={colors.textMuted} />
                </Pressable>
              </Row>
              {viewersLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Spinner size="large" />
                </View>
              ) : viewers.length === 0 ? (
                <AppText muted center style={{ paddingVertical: 32 }}>
                  No views yet.
                </AppText>
              ) : (
                <View style={{ gap: 4 }}>
                  {viewers.map((v, i) => (
                    <Row key={`${v.user.displayName}-${i}`} gap={12} style={{ paddingVertical: 8 }}>
                      <Avatar uri={resolveMediaUrl(v.user.avatarUrl)} name={v.user.displayName} size={32} />
                      <AppText variant="body" style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>
                        {v.user.displayName}
                      </AppText>
                      <AppText variant="caption" muted>
                        {timeAgo(v.viewedAt)}
                      </AppText>
                    </Row>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** A single segmented progress bar. */
function SegmentBar({
  filled,
  active,
  progress,
}: {
  filled: boolean;
  active: boolean;
  progress: SharedValue<number>;
}) {
  const animStyle = useAnimatedStyle(() => ({
    width: active ? `${progress.value * 100}%` : filled ? '100%' : '0%',
  }));
  return (
    <View style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 2, backgroundColor: '#fff' }, animStyle]} />
    </View>
  );
}
