import { View, StyleSheet, Pressable } from 'react-native';
import { Phone, Video, MonitorUp, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { AppText, Avatar } from '@/components/ui';
import { resolveMediaUrl } from '@/lib/env';
import { useCall } from '@/hooks/use-call';
import type { CallType } from '@/stores/call-store';

interface ChatHeaderProps {
  partnerName: string;
  partnerAvatar?: string | null;
  /** Partner user id — used to initiate calls. */
  partnerId?: string | null;
  isOnline: boolean;
  lastSeenAt?: string;
  onBack?: () => void;
}

/** Lightweight relative-time, mirrors @linkup/utils timeAgo for the status line. */
function timeAgo(dateStr: string): string {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function ChatHeader({
  partnerName,
  partnerAvatar,
  partnerId,
  isOnline,
  lastSeenAt,
  onBack,
}: ChatHeaderProps) {
  const { colors } = useTheme();
  const { startCall } = useCall();

  const statusText = isOnline
    ? 'Online'
    : lastSeenAt
      ? `Last seen ${timeAgo(lastSeenAt)}`
      : 'Offline';

  const peer = {
    id: partnerId ?? undefined,
    displayName: partnerName,
    avatarUrl: partnerAvatar ?? undefined,
  };
  const callDisabled = !partnerId;

  const callBtn = (type: CallType, Icon: typeof Phone, label: string) => (
    <Pressable
      onPress={() => startCall(type, peer)}
      disabled={callDisabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: pressed ? colors.surfaceHover : 'transparent', opacity: callDisabled ? 0.4 : 1 },
      ]}
    >
      <Icon color={colors.textMuted} size={20} />
    </Pressable>
  );

  return (
    <View style={[styles.row, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} accessibilityLabel="Go back" style={styles.backBtn}>
          <ChevronLeft color={colors.textMuted} size={24} />
        </Pressable>
      ) : null}

      <Avatar uri={resolveMediaUrl(partnerAvatar)} name={partnerName} size={40} online={isOnline} />

      <View style={styles.info}>
        <AppText variant="subtitle" weight="600" numberOfLines={1}>
          {partnerName}
        </AppText>
        <AppText
          variant="caption"
          color={isOnline ? colors.success : colors.textMuted}
          numberOfLines={1}
        >
          {statusText}
        </AppText>
      </View>

      <View style={styles.actions}>
        {callBtn('voice', Phone, 'Voice call')}
        {callBtn('video', Video, 'Video call')}
        {callBtn('screen', MonitorUp, 'Share screen')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 2 },
  info: { flex: 1, minWidth: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
