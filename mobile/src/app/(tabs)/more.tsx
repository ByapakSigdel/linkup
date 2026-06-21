import { Menu } from 'lucide-react-native';

import { Screen, EmptyState } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { useTheme } from '@/theme';

export default function MoreScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <ScreenHeader title="More" />
      <EmptyState
        icon={<Menu color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="More tools and settings will live here."
      />
    </Screen>
  );
}
