import { Gamepad2 } from 'lucide-react-native';

import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';

export default function GamesScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Games" />
      <EmptyState
        icon={<Gamepad2 color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Two-player games will live here."
      />
    </Screen>
  );
}
