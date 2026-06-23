import React, { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/ui';
import { ScreenHeader } from '@/components/top-bar';
import { LinkUpPanel } from '@/components/link-up-panel';
import { useAuthStore } from '@/stores/auth-store';
import { useResponsive } from '@/hooks/use-responsive';

/** Standalone pairing route. The primary entry point is the Home screen, which
 *  renders the same <LinkUpPanel/> inline; this keeps /pair deep-linkable. */
export default function PairScreen() {
  const { contentMaxWidth } = useResponsive();
  const isPaired = useAuthStore((s) => s.couple?.isPaired);

  useEffect(() => {
    if (isPaired) router.replace('/dashboard');
  }, [isPaired]);

  return (
    <Screen scroll maxWidth={contentMaxWidth}>
      <ScreenHeader title="Link up" />
      <View style={{ padding: 16 }}>
        <LinkUpPanel />
      </View>
    </Screen>
  );
}
