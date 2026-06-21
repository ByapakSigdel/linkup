import { MailCheck } from 'lucide-react-native';

import { Screen, Heading, EmptyState } from '@/components/ui';
import { useTheme } from '@/theme';

export default function VerifyScreen() {
  const { colors } = useTheme();
  return (
    <Screen>
      <Heading>Verify your email</Heading>
      <EmptyState
        icon={<MailCheck color={colors.textMuted} size={40} />}
        title="Coming soon"
        subtitle="Enter your verification code."
      />
    </Screen>
  );
}
