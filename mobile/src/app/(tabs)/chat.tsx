import { MessageCircle } from 'lucide-react-native';

import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';

export default function ChatScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Chat" />
      <EmptyState
        icon={<MessageCircle color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Your conversation will live here."
      />
    </Screen>
  );
}
