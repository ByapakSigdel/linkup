import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  MessageCircle,
  Image as ImageIcon,
  Flame,
  Trophy,
  Star,
  Calendar,
  Edit3,
  Heart,
  Settings,
  ChevronRight,
} from 'lucide-react-native';

import {
  Screen,
  AppText,
  Muted,
  Button,
  Card,
  Input,
  Avatar,
  Badge,
  Spinner,
  Divider,
  Row,
  EmptyState,
  Touchable,
} from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/env';

interface ProfileData {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    isOnline: boolean | null;
  };
  partner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    isOnline: boolean | null;
  } | null;
  coupleStats: {
    couple: {
      id: string;
      coupleName: string | null;
      anniversaryDate: string | null;
      createdAt: string | null;
    };
    messageCount: number;
    mediaCount: number;
    currentStreak: number;
    longestStreak: number;
    totalPoints: number;
    achievementCount: number;
    showcasedAchievements: Array<{
      id: string;
      achievementId: string;
      unlockedAt: string | null;
    }>;
  } | null;
}

export default function ProfileScreen() {
  const { colors, radius } = useTheme();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '' });

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/users/me/profile');
      const data = res.data.data as ProfileData;
      setProfile(data);
      setEditForm({
        displayName: data.user.displayName,
        bio: data.user.bio || '',
      });
    } catch {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/users/me', editForm);
      setIsEditing(false);
      await fetchProfile();
    } catch {
      // Leave the form open so the user can retry.
    } finally {
      setSaving(false);
    }
  };

  const daysTogether = profile?.coupleStats?.couple.createdAt
    ? Math.floor(
        (Date.now() - new Date(profile.coupleStats.couple.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;

  if (isLoading) {
    return (
      <Screen>
        <ScreenHeader title="Profile" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </View>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen>
        <ScreenHeader title="Profile" />
        <EmptyState
          icon={<Heart color={colors.textMuted} size={40} />}
          title="Failed to load profile"
          subtitle="Pull to retry in a moment."
          action={<Button label="Retry" onPress={() => void fetchProfile()} />}
        />
      </Screen>
    );
  }

  const { user, partner, coupleStats } = profile;
  const coupleTitle =
    coupleStats?.couple.coupleName ||
    (partner ? `${user.displayName} & ${partner.displayName}` : user.displayName);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16 }}>
        <ScreenHeader
          title="Profile"
          right={
            <Touchable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.button,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Settings color={colors.text} size={16} />
              <AppText variant="label">Settings</AppText>
            </Touchable>
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Couple header */}
        {partner && coupleStats && (
          <Animated.View entering={FadeInDown.duration(350)}>
            <Card variant="elevated">
              <View style={{ alignItems: 'center', gap: 12 }}>
                <Row gap={16}>
                  <Avatar
                    uri={resolveMediaUrl(user.avatarUrl)}
                    name={user.displayName}
                    size={64}
                    online={!!user.isOnline}
                  />
                  <Heart color={colors.primary} size={24} fill={colors.primary} />
                  <Avatar
                    uri={resolveMediaUrl(partner.avatarUrl)}
                    name={partner.displayName}
                    size={64}
                    online={!!partner.isOnline}
                  />
                </Row>
                <AppText variant="title" center>
                  {coupleTitle}
                </AppText>
                <Muted center>
                  Together for{' '}
                  <AppText color={colors.text} weight="700">
                    {daysTogether}
                  </AppText>{' '}
                  days
                </Muted>
                {coupleStats.couple.anniversaryDate && (
                  <AppText variant="caption" muted center>
                    Since{' '}
                    {new Date(
                      coupleStats.couple.anniversaryDate,
                    ).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </AppText>
                )}
              </View>
            </Card>
          </Animated.View>
        )}

        {/* Partner profiles / edit */}
        <Card>
          <View style={{ gap: 16 }}>
            {/* You */}
            <Row gap={16}>
              <Avatar
                uri={resolveMediaUrl(user.avatarUrl)}
                name={user.displayName}
                size={56}
              />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                {isEditing ? (
                  <View style={{ gap: 8 }}>
                    <Input
                      value={editForm.displayName}
                      onChangeText={(t) =>
                        setEditForm((f) => ({ ...f, displayName: t }))
                      }
                      placeholder="Display name"
                    />
                    <Input
                      value={editForm.bio}
                      onChangeText={(t) =>
                        setEditForm((f) => ({ ...f, bio: t }))
                      }
                      placeholder="Add a bio..."
                    />
                  </View>
                ) : (
                  <>
                    <AppText variant="subtitle">{user.displayName}</AppText>
                    <Muted variant="caption">@{user.username}</Muted>
                    {user.bio ? (
                      <AppText
                        variant="caption"
                        muted
                        style={{ fontStyle: 'italic' }}
                      >
                        &quot;{user.bio}&quot;
                      </AppText>
                    ) : null}
                  </>
                )}
              </View>
              {isEditing ? null : (
                <Touchable
                  onPress={() => setIsEditing(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                >
                  <Edit3 color={colors.textMuted} size={18} />
                </Touchable>
              )}
            </Row>

            {isEditing && (
              <Row gap={8}>
                <Button
                  label="Save"
                  size="sm"
                  loading={saving}
                  onPress={handleSave}
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setIsEditing(false);
                    setEditForm({
                      displayName: user.displayName,
                      bio: user.bio || '',
                    });
                  }}
                />
              </Row>
            )}

            <Divider />

            {/* Partner */}
            {partner && (
              <Row gap={16}>
                <Avatar
                  uri={resolveMediaUrl(partner.avatarUrl)}
                  name={partner.displayName}
                  size={56}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <AppText variant="subtitle">{partner.displayName}</AppText>
                  <Muted variant="caption">@{partner.username}</Muted>
                  {partner.bio ? (
                    <AppText
                      variant="caption"
                      muted
                      style={{ fontStyle: 'italic' }}
                    >
                      &quot;{partner.bio}&quot;
                    </AppText>
                  ) : null}
                </View>
                <Badge
                  label={partner.isOnline ? 'Online' : 'Offline'}
                  variant={partner.isOnline ? 'success' : 'muted'}
                />
              </Row>
            )}
          </View>
        </Card>

        {/* Relationship stats */}
        {coupleStats && (
          <Card>
            <View style={{ gap: 12 }}>
              <View>
                <AppText
                  variant="caption"
                  muted
                  style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}
                >
                  By the numbers
                </AppText>
                <AppText variant="subtitle">Relationship Stats</AppText>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }}
              >
                <StatItem
                  icon={<MessageCircle color={colors.primary} size={20} />}
                  bg={colors.primaryLight}
                  value={coupleStats.messageCount.toLocaleString()}
                  label="Messages Sent"
                />
                <StatItem
                  icon={<ImageIcon color={colors.secondary} size={20} />}
                  bg={colors.surfaceHover}
                  value={coupleStats.mediaCount.toLocaleString()}
                  label="Photos Shared"
                />
                <StatItem
                  icon={<Flame color={colors.accent} size={20} />}
                  bg={colors.surfaceHover}
                  value={`${coupleStats.currentStreak} days`}
                  label="Current Streak"
                />
                <StatItem
                  icon={<Trophy color={colors.accent} size={20} />}
                  bg={colors.surfaceHover}
                  value={`${coupleStats.achievementCount}`}
                  label="Achievements"
                />
                <StatItem
                  icon={<Star color={colors.secondary} size={20} />}
                  bg={colors.surfaceHover}
                  value={coupleStats.totalPoints.toLocaleString()}
                  label="Total Points"
                />
                <StatItem
                  icon={<Calendar color={colors.success} size={20} />}
                  bg={colors.surfaceHover}
                  value={`${daysTogether}`}
                  label="Days Together"
                />
              </View>
            </View>
          </Card>
        )}

        {/* Showcased achievements */}
        {coupleStats && coupleStats.showcasedAchievements.length > 0 && (
          <Card>
            <View style={{ gap: 12 }}>
              <View>
                <AppText
                  variant="caption"
                  muted
                  style={{ letterSpacing: 1.5, textTransform: 'uppercase' }}
                >
                  On display
                </AppText>
                <AppText variant="subtitle">Showcased Achievements</AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {coupleStats.showcasedAchievements.map((a) => (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: radius.card,
                      backgroundColor: colors.surfaceHover,
                      padding: 12,
                      flexGrow: 1,
                      minWidth: '46%',
                    }}
                  >
                    <Trophy color={colors.accent} size={24} />
                    <View>
                      <AppText variant="label">Achievement</AppText>
                      {a.unlockedAt && (
                        <Muted variant="caption">
                          {new Date(a.unlockedAt).toLocaleDateString()}
                        </Muted>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Card>
        )}

        {/* Quick links */}
        <Row gap={12} style={{ alignItems: 'stretch' }}>
          <QuickLink
            icon={<Flame color={colors.accent} size={24} />}
            title="Photo Streaks"
            subtitle="View streak details"
            onPress={() => router.push('/streaks')}
          />
          <QuickLink
            icon={<Trophy color={colors.accent} size={24} />}
            title="Hall of Fame"
            subtitle="Saved highlights"
            onPress={() => router.push('/hall-of-fame')}
          />
        </Row>

        {/* Logout shortcut to settings */}
        <Button
          label="Settings & Log Out"
          variant="outline"
          leftIcon={<Settings color={colors.text} size={16} />}
          onPress={() => router.push('/settings')}
        />
      </ScrollView>
    </Screen>
  );
}

function StatItem({
  icon,
  bg,
  value,
  label,
}: {
  icon: React.ReactNode;
  bg: string;
  value: string;
  label: string;
}) {
  const { radius } = useTheme();
  return (
    <View
      style={{
        width: '50%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          height: 40,
          width: 40,
          borderRadius: radius.button,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flexShrink: 1 }}>
        <AppText variant="subtitle">{value}</AppText>
        <Muted variant="caption">{label}</Muted>
      </View>
    </View>
  );
}

function QuickLink({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Touchable onPress={onPress} style={{ flex: 1 }}>
      <Card>
        <Row gap={12}>
          {icon}
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="label">{title}</AppText>
            <Muted variant="caption">{subtitle}</Muted>
          </View>
          <ChevronRight color={colors.textMuted} size={18} />
        </Row>
      </Card>
    </Touchable>
  );
}
