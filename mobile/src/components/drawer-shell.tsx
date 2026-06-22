import React, { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useUIStore } from '@/stores/ui-store';
import { Sidebar } from '@/components/sidebar';

/**
 * Custom slide-out sidebar host. Expo SDK 56 dropped expo-router's
 * react-navigation compatibility, so we render our own drawer: the screen
 * content (children) plus an animated panel + backdrop driven by useUIStore.
 */
export function DrawerShell({ children }: { children: React.ReactNode }) {
  const open = useUIStore((s) => s.drawerOpen);
  const close = useUIStore((s) => s.closeDrawer);
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(300, Math.round(width * 0.84));

  const tx = useSharedValue(-panelWidth);
  const fade = useSharedValue(0);

  useEffect(() => {
    tx.value = withTiming(open ? 0 : -panelWidth, { duration: 240 });
    fade.value = withTiming(open ? 1 : 0, { duration: 240 });
  }, [open, panelWidth, tx, fade]);

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={{ flex: 1 }}>
      {children}

      {/* Backdrop */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}
      >
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close menu" />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, width: panelWidth },
          panelStyle,
        ]}
      >
        <Sidebar />
      </Animated.View>
    </View>
  );
}
