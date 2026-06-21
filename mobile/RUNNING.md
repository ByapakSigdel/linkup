# Running LinkUp Mobile

A React Native (Expo SDK 56) port of the LinkUp web app. It talks to the **same
backend** as the web app — the NestJS API + Postgres running on this PC.

## 1. Start the backend (same DB as web)

From the repo root (`c:/Users/user/Documents/linkup`):

```bash
docker compose up -d          # Postgres (:5433) + Redis (:6379)
cd apps/api && npm run dev     # API on http://0.0.0.0:4000  (LAN-reachable)
```

The API binds all interfaces, so the phone reaches it at the PC's LAN IP.
Confirm: `curl http://192.168.100.93:4000/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{}'`
should return a JSON error (not a connection failure).

## 2. Point the app at this PC

The app defaults to `http://192.168.100.93:4000` (this machine's LAN IP). If the
IP changes, override without editing code:

```bash
# mobile/.env
EXPO_PUBLIC_API_HOST=192.168.100.93
EXPO_PUBLIC_API_PORT=4000
```

The **phone and PC must be on the same Wi-Fi**, and Windows Firewall must allow
inbound TCP 4000 (allow it once when prompted, or add a rule).

## 3a. Run everything except calls (Expo Go — fastest)

```bash
cd mobile
npx expo start            # scan the QR with Expo Go (Android) on the same Wi-Fi
```

Every feature works in Expo Go **except WebRTC voice/video calls**, which need a
native module (see 3b). The call UI still appears in Expo Go but shows a
"needs the full app build" notice.

## 3b. Run with calls (development build)

WebRTC requires a custom dev client (not Expo Go). With Android Studio + an
emulator or a USB device:

```bash
cd mobile
npx expo run:android      # builds & installs the dev client with react-native-webrtc
```

or build in the cloud with EAS (`npx eas build --profile development -p android`).

## Notes
- Theme, auth, realtime (chat/typing/presence/reactions), scribble/paint relay,
  watch-party sync, soundboard, and all 17 games run over the same Socket.IO
  gateway as the web app.
- Media URLs returned by the API are resolved against the LAN origin
  automatically (`resolveMediaUrl`).
