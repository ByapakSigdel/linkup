import { Users } from 'lucide-react-native';

import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';

export default function CirclesScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Circles" />
      <EmptyState
        icon={<Users color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Couple circles will live here."
      />
    </Screen>
  );
}
