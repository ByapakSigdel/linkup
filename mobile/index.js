// Custom entry: register the FCM background message handler BEFORE the app boots
// (side-effect import order is preserved), then hand off to expo-router.
import './src/lib/background-message';
import 'expo-router/entry';
