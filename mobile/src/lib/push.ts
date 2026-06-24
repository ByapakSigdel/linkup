import { Platform } from 'react-native';
import { router } from 'expo-router';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
  EventType,
} from '@notifee/react-native';
import api from '@/lib/api';

const CHANNEL_ID = 'messages';
const ACCENT = '#c4a8e0';

/** Ensure the high-importance "Messages" channel exists (Android). */
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

/**
 * Render a rich, chat-style notification from an FCM data message. Shared by the
 * foreground (onMessage) and background/killed (setBackgroundMessageHandler)
 * paths so the look is identical in every app state.
 *
 * Expected data: { title (sender name), body (message), avatarUrl?, type }.
 */
export async function displayPushNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
): Promise<void> {
  const data = (remoteMessage?.data ?? {}) as Record<string, string>;
  const title = data.title || 'New message';
  const body = data.body || 'Sent you a message';
  const avatar = data.avatarUrl || undefined;

  await ensureChannel();

  await notifee.displayNotification({
    title,
    body,
    data,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      color: ACCENT,
      largeIcon: avatar,
      circularLargeIcon: true,
      pressAction: { id: 'default', launchActivity: 'default' },
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PRIVATE,
      // WhatsApp-style conversation layout: sender (name + avatar) + the message.
      style: {
        type: AndroidStyle.MESSAGING,
        person: { name: title, icon: avatar },
        messages: [{ text: body, timestamp: Date.now() }],
      },
    },
  });
}

let registered = false;

/**
 * Request notification permission, register this device's FCM token with the
 * backend, create the channel, and wire foreground display + tap-to-open.
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

    // Foreground messages are surfaced in-app by the realtime provider (live chat
    // + an in-app toast when you're not in the chat), so we deliberately DON'T pop
    // a system notification here — that would double up and even notify you about
    // the chat you're actively reading. The background/killed path
    // (background-message.ts) is what shows the rich notification.
    messaging().onMessage(async () => {});

    // Tap (foreground/background-resumed) → open the chat.
    notifee.onForegroundEvent(({ type }) => {
      if (type === EventType.PRESS) openChat();
    });
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
