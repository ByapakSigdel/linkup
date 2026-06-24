import { Platform } from 'react-native';
import { router } from 'expo-router';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';
import api from '@/lib/api';

const CHANNEL_ID = 'messages';
const ACCENT = '#c4a8e0';

/**
 * Ensure the high-importance "Messages" channel exists (Android 8+). FCM
 * notification messages target this channel id, so it must exist for them to
 * pop with sound/heads-up.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Messages',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 250, 300, 250],
    lights: true,
    lightColor: ACCENT,
  });
}

let registered = false;

/**
 * Request notification permission, create the channel, register this device's
 * FCM token with the backend, and wire tap-to-open-chat.
 *
 * Display itself is left to the OS: the server sends NOTIFICATION messages, which
 * Android renders directly when the app is backgrounded/killed (reliable even
 * under battery optimization). Foreground messages are surfaced in-app by the
 * realtime provider, so we intentionally don't pop a system notification then.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (registered) return;
  try {
    const status = await messaging().requestPermission();
    const ok =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!ok) return;

    await ensureChannel();

    const token = await messaging().getToken();
    if (token) {
      await api.post('/users/me/push-token', { token });
      registered = true;
    }

    // Foreground messages: handled in-app (live chat + toast), so don't also pop
    // a system notification — that would double up and notify you about the chat
    // you're already reading.
    messaging().onMessage(async () => {});

    // Tap on a notification while the app is backgrounded → open the chat.
    messaging().onNotificationOpenedApp(() => openChat());
    // Tap that cold-launched the app from a killed state → open the chat.
    const initial = await messaging().getInitialNotification();
    if (initial) openChat();
  } catch {
    // best-effort — never block app start on notification setup
  }
}

function openChat() {
  try {
    router.navigate('/chat');
  } catch {
    /* router not ready */
  }
}
