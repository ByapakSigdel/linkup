// Profile header for a couple's Circle. Ported from
// apps/web/src/components/circles/profile-header.tsx. Avatar (with optional
// story-ring slot), @handle, name, bio, follower/following/post counts. Non-owner
// sees a FollowButton; owner sees a privacy toggle badge + Edit affordance.

import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Globe, Lock, Pencil } from 'lucide-react-native';
import { Avatar, AppText, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import { useToastStore } from '@/stores/toast-store';
import * as circlesApi from '@/lib/circles-api';
import { FollowButton } from './follow-button';
import { formatCount } from './helpers';
import type { CircleProfileResponse, FollowState } from './types';

interface ProfileHeaderProps {
  profile: CircleProfileResponse;
  hasStories?: boolean;
  storiesSeen?: boolean;
  onOpenStories?: () => void;
  onEdit?: () => void;
  onFollowChange?: (state: FollowState) => void;
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <AppText variant="subtitle" weight="700">
        {formatCount(value)}
      </AppText>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

export function ProfileHeader({
  profile,
  hasStories = false,
  storiesSeen = false,
  onOpenStories,
  onEdit,
  onFollowChange,
}: ProfileHeaderProps) {
  const { colors } = useTheme();
  const { circle, isOwner, followState } = profile;
  const pushToast = useToastStore((s) => s.push);

  const [isPrivate, setIsPrivate] = useState(circle.isPrivate);
  const [followerCount, setFollowerCount] = useState(circle.followerCount);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);

  const hasRing = hasStories || storiesSeen;
  const ringActive = hasStories;

  async function togglePrivacy() {
    if (togglingPrivacy) return;
    const next = !isPrivate;
    setIsPrivate(next);
    setTogglingPrivacy(true);
    try {
      await circlesApi.updateMyCircle({ isPrivate: next });
      pushToast({
        title: next ? 'Circle set to private' : 'Circle set to public',
        body: next
          ? 'New followers will need to request access.'
          : 'Anyone can now follow and see your posts.',
        variant: 'success',
      });
    } catch {
      setIsPrivate(!next);
      pushToast({ title: 'Could not update privacy', body: 'Please try again.' });
    } finally {
      setTogglingPrivacy(false);
    }
  }

  function handleFollowChange(state: FollowState) {
    setFollowerCount((c) => {
      if (state === 'accepted' && followState !== 'accepted') return c + 1;
      if (state === 'none' && followState === 'accepted') return Math.max(c - 1, 0);
      return c;
    });
    onFollowChange?.(state);
  }

  const avatar = (
    <Avatar uri={resolveMediaUrl(circle.avatarUrl)} name={circle.name} size={88} />
  );

  return (
    <View style={{ gap: 16 }}>
      <Row gap={20} style={{ alignItems: 'flex-start' }}>
        {/* Avatar + story ring slot */}
        <Pressable onPress={hasRing ? onOpenStories : undefined} disabled={!hasRing} accessibilityLabel={circle.name}>
          {ringActive ? (
            <LinearGradient
              colors={[colors.primary, colors.secondary, colors.primary]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={{ borderRadius: 999, padding: 3 }}
            >
              <View style={{ borderRadius: 999, padding: 2, backgroundColor: colors.surface }}>{avatar}</View>
            </LinearGradient>
          ) : hasRing ? (
            <View style={{ borderRadius: 999, padding: 3, backgroundColor: colors.borderStrong }}>
              <View style={{ borderRadius: 999, padding: 2, backgroundColor: colors.surface }}>{avatar}</View>
            </View>
          ) : (
            avatar
          )}
        </Pressable>

        {/* Identity + counts */}
        <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
          <Row gap={10} style={{ flexWrap: 'wrap' }}>
            <AppText variant="title" numberOfLines={1} style={{ flexShrink: 1 }}>
              {circle.handle ? `@${circle.handle}` : circle.name}
            </AppText>

            {isOwner ? (
              <Row gap={8}>
                <Pressable onPress={togglePrivacy} disabled={togglingPrivacy} accessibilityLabel={isPrivate ? 'Make circle public' : 'Make circle private'}>
                  <Row
                    gap={4}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: isPrivate ? 'transparent' : colors.success,
                      borderWidth: isPrivate ? 1 : 0,
                      borderColor: colors.border,
                      opacity: togglingPrivacy ? 0.5 : 1,
                    }}
                  >
                    {isPrivate ? (
                      <Lock size={12} color={colors.textMuted} />
                    ) : (
                      <Globe size={12} color={colors.textOnPrimary} />
                    )}
                    <AppText style={{ fontSize: 11, fontWeight: '700' }} color={isPrivate ? colors.textMuted : colors.textOnPrimary}>
                      {isPrivate ? 'Private' : 'Public'}
                    </AppText>
                  </Row>
                </Pressable>
                {onEdit ? (
                  <Pressable onPress={onEdit}>
                    <Row gap={4} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
                      <Pencil size={12} color={colors.text} />
                      <AppText style={{ fontSize: 11, fontWeight: '700' }}>Edit</AppText>
                    </Row>
                  </Pressable>
                ) : null}
              </Row>
            ) : (
              <FollowButton
                idOrHandle={circle.handle ?? circle.id}
                followState={followState}
                isPrivate={isPrivate}
                onStateChange={handleFollowChange}
              />
            )}
          </Row>

          <Row gap={28}>
            <Stat value={circle.postCount} label="posts" />
            <Stat value={followerCount} label="followers" />
            <Stat value={circle.followingCount} label="following" />
          </Row>
        </View>
      </Row>

      {/* Name + bio */}
      <View style={{ gap: 2 }}>
        {circle.handle ? <AppText variant="label">{circle.name}</AppText> : null}
        {circle.bio ? (
          <AppText variant="body" muted style={{ fontSize: 14 }}>
            {circle.bio}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
