import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import api from '@/lib/api';

// How notifications behave while the app is foregrounded. (The backend only
// pushes to *offline* recipients, so foreground rarely hits this — but be sane.)
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // legacy key for older expo-notifications versions
      shouldShowAlert: true,
    }) as Notifications.NotificationBehavior,
});

// Tapping a message notification opens the chat.
Notifications.addNotificationResponseReceivedListener(() => {
  try {
    router.navigate('/chat');
  } catch {
    /* router not ready yet */
  }
});

let registered = false;

/**
 * Ask for notification permission, get this device's FCM token, and register it
 * with the backend so it can push "new message" notifications when the app is
 * closed. Best-effort + idempotent (runs once per session).
 */
export async function registerForPushNotifications(): Promise<void> {
  if (registered) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    let granted = (await Notifications.getPermissionsAsync()).granted;
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token = tokenResp?.data ? String(tokenResp.data) : '';
    if (token) {
      await api.post('/users/me/push-token', { token });
      registered = true;
    }
  } catch {
    // best-effort — never block app start on notification setup
  }
}
