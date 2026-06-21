import { Home } from 'lucide-react-native';

import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';

export default function DashboardScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Home" />
      <EmptyState
        icon={<Home color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Your dashboard will live here."
      />
    </Screen>
  );
}
