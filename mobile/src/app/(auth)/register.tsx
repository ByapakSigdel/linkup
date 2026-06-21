import { UserPlus } from 'lucide-react-native';

import { Screen, Heading, EmptyState } from '@/components/ui';
import { useTheme } from '@/theme';

export default function RegisterScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Heading>Create account</Heading>
      <EmptyState
        icon={<UserPlus color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Join LinkUp."
      />
    </Screen>
  );
}
