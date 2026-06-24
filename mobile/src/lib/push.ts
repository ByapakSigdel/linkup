import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
const BATTERY_PROMPT_KEY = 'battery-opt-prompt-seen';

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
 * Render a rich, chat-style notification from an FCM data message — sender name
 * as the title, the message as the body, and the partner's CIRCULAR AVATAR as the
 * large icon (WhatsApp/Discord style). Shared by the foreground (onMessage) and
 * background/killed (setBackgroundMessageHandler) paths so it looks identical in
 * every app state.
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
      // The partner's avatar, shown as a circular large icon like WhatsApp.
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

/**
 * On aggressive OEMs (Xiaomi/Samsung/Oppo/Vivo…) background FCM messages are
 * dropped unless the app is exempt from battery optimization. Prompt once to fix
 * it, so message notifications arrive reliably even when the app is closed.
 */
async function maybePromptBatteryOptimization(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    if (await AsyncStorage.getItem(BATTERY_PROMPT_KEY)) return;
    const restricted = await notifee.isBatteryOptimizationEnabled();
    if (!restricted) return;
    await AsyncStorage.setItem(BATTERY_PROMPT_KEY, '1');
    Alert.alert(
      'Get message notifications',
      'To receive notifications when LinkUp is closed, allow it to run in the background (disable battery optimization).',
      [
        {
          text: 'Allow',
          onPress: () => {
            void notifee.openBatteryOptimizationSettings();
          },
        },
        { text: 'Not now', style: 'cancel' },
      ],
    );
  } catch {
    /* best-effort */
  }
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
    // + an in-app toast when you're not in the chat), so don't also pop a system
    // notification — that would double up and notify you about the chat you're
    // already reading.
    messaging().onMessage(async () => {});

    // Tap a Notifee notification (foreground or background-resumed) → open chat.
    notifee.onForegroundEvent(({ type }) => {
      if (type === EventType.PRESS) openChat();
    });
    // Tap that cold-launched the app from a killed state → open chat.
    const initial = await notifee.getInitialNotification();
    if (initial) openChat();

    void maybePromptBatteryOptimization();
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
