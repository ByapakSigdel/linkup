import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { router } from 'expo-router';
import { displayPushNotification } from '@/lib/push';

/**
 * Registers FCM handlers that must exist before the app boots — specifically the
 * background/killed-state handler that renders the rich Notifee notification
 * (sender name + circular avatar + message). Data-only high-priority messages
 * wake this handler so we can render the avatar, which FCM's own notification
 * block can't show. Imported first from index.js, ahead of expo-router/entry.
 */
messaging().setBackgroundMessageHandler(displayPushNotification);

notifee.onBackgroundEvent(async ({ type }) => {
  if (type === EventType.PRESS) {
    try {
      router.navigate('/chat');
    } catch {
      /* router not ready */
    }
  }
});
