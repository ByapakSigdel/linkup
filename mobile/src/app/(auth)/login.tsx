import { LogIn } from 'lucide-react-native';

import { Screen, Heading, EmptyState } from '@/components/ui';
import { useTheme } from '@/theme';

export default function LoginScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Heading>Welcome back</Heading>
      <EmptyState
        icon={<LogIn color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Sign in to LinkUp."
      />
    </Screen>
  );
}
