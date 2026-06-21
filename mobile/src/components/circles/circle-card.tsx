// CircleCard — a single result row for Discover and Following/Followers lists.
// Ported from apps/web/src/components/circles/circle-card.tsx. Shows the couple's
// avatar, @handle, display name, follower count (when known), and an embedded
// FollowButton. Accepts both CircleProfile and CircleSummary shapes.

import { View } from 'react-native';
import { router } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { Avatar, AppText, Card, Touchable, Row } from '@/components/ui';
import { useTheme } from '@/theme';
import { resolveMediaUrl } from '@/lib/env';
import { FollowButton } from './follow-button';
import { formatCount } from './helpers';
import type { CircleProfile, CircleSummary, FollowState } from './types';

export interface CircleCardProps {
  circle: CircleProfile | CircleSummary;
  hideFollow?: boolean;
  onFollowChange?: (id: string, state: FollowState) => void;
}

function hasProfileFields(c: CircleProfile | CircleSummary): c is CircleProfile {
  return 'followerCount' in c;
}

export function CircleCard({
  circle,
  hideFollow = false,
  onFollowChange,
}: CircleCardProps) {
  const { colors } = useTheme();
  const profile = hasProfileFields(circle) ? circle : null;
  const followState: FollowState = circle.followState ?? 'none';
  const isPrivate = profile?.isPrivate ?? false;
  const isOwner = profile?.isOwner ?? false;

  const routeKey = circle.handle ?? circle.id;
  const displayHandle = circle.handle ? `@${circle.handle}` : null;
  const followerCount = profile?.followerCount;

  return (
    <Card variant="bordered" padded={false} style={{ padding: 12 }}>
      <Row gap={12} style={{ alignItems: 'center' }}>
        <Touchable
          onPress={() => router.push(`/circles/${encodeURIComponent(routeKey)}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
        >
          <Avatar uri={resolveMediaUrl(circle.avatarUrl)} name={circle.name} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Row gap={6}>
              <AppText variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                {circle.name}
              </AppText>
              {isPrivate ? <Lock size={14} color={colors.textMuted} /> : null}
            </Row>
            {displayHandle ? (
              <AppText variant="caption" muted numberOfLines={1}>
                {displayHandle}
              </AppText>
            ) : null}
            {followerCount != null ? (
              <AppText variant="caption" muted style={{ marginTop: 2 }}>
                <AppText variant="caption" weight="700">
                  {formatCount(followerCount)}
                </AppText>{' '}
                {followerCount === 1 ? 'follower' : 'followers'}
              </AppText>
            ) : null}
          </View>
        </Touchable>

        {!hideFollow && !isOwner ? (
          <FollowButton
            idOrHandle={routeKey}
            followState={followState}
            isPrivate={isPrivate}
            isOwner={isOwner}
            size="sm"
            onStateChange={(s) => onFollowChange?.(circle.id, s)}
          />
        ) : null}
      </Row>
    </Card>
  );
}
