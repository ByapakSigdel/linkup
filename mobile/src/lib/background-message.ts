import messaging from '@react-native-firebase/messaging';

/**
 * Push messages carry a `notification` block, so the OS renders them directly
 * when the app is backgrounded/killed — reliable even under OEM battery
 * optimization, which silently drops data-only messages (proven on-device).
 * RNFirebase still requires a background handler for the data payload, but it
 * must NOT display anything itself or we'd get a duplicate notification.
 *
 * Imported first from index.js, ahead of expo-router/entry.
 */
messaging().setBackgroundMessageHandler(async () => {
  // no-op: the system tray shows the notification; tap routing is wired in
  // push.ts via onNotificationOpenedApp / getInitialNotification.
});
