# LinkUp Mobile — Build Contract (read fully before writing code)

A React Native (Expo SDK 56, expo-router, React 19, TypeScript **strict**) port of the LinkUp web app. It must reach **feature parity** with the web app and talk to the **same backend** (NestJS API + Socket.IO) running on this PC's LAN IP. UI must feel as crisp as the web version, with loading states, empty states, and animations.

- Mobile app root: `c:/Users/user/Documents/linkup/mobile`
- Web app (your source of truth for behavior, copy, API calls, and game logic): `c:/Users/user/Documents/linkup/apps/web/src`
- Backend API source (endpoint contracts): `c:/Users/user/Documents/linkup/apps/api/src`
- **When in doubt about what a screen does, what it calls, or its exact copy, OPEN THE WEB FILE and port it faithfully.**

## Golden rules
1. **No web-isms.** No `className`, no Tailwind, no `'use client'`, no DOM, no `localStorage`, no `next/*`, no `<div>`. Use React Native primitives (`View`, `Text`, `Pressable`, `FlatList`, `ScrollView`, `Image`, `TextInput`).
2. **Theme tokens only.** Never hardcode hex. Get colors from `useTheme()`.
3. Use the shared UI kit from `@/components/ui` instead of re-styling primitives.
4. Every screen handles: **loading**, **empty**, **error**, and the **happy path**. Add subtle animations (reanimated) where it elevates the feel.
5. TypeScript strict + `noUncheckedIndexedAccess` is NOT on here, but write safe code anyway.
6. Path alias: `@/*` → `src/*`.

## Theme — `@/theme`
```ts
import { useTheme, useColors } from '@/theme';
const { colors, radius, isLight, id, meta } = useTheme();
```
`colors` (all string hex) keys:
`primary, primaryHover, primaryLight, secondary, secondaryHover, accent, accentHover, background, backgroundAlt, surface, surfaceHover, surfaceActive, text, textMuted, textInverse, textOnPrimary, border, borderStrong, borderFocus, success, warning, error, info, messageSent, messageSentText, messageReceived, messageReceivedText, highlightLove, highlightFunny, highlightImportant, highlightCelebration, highlightMilestone`.
`radius` = `{ card, button, input }` (numbers). `isLight` boolean. 6 themes: default, loveletter, daybreak, brutalist, minimal, arcade.

## UI kit — `@/components/ui`
- `Screen({ children, scroll?, padded?=true, edges?=['top'], contentStyle?, style? })` — themed SafeArea container.
- `AppText({ variant?: 'display'|'title'|'subtitle'|'body'|'caption'|'label', muted?, color?, weight?, center? })`, plus `Heading`, `Muted`.
- `Button({ label?|children, onPress, variant?: 'primary'|'secondary'|'outline'|'ghost'|'destructive', size?: 'sm'|'md'|'lg', loading?, disabled?, leftIcon?, fullWidth? })`.
- `Card({ children, variant?: 'bordered'|'elevated'|'flat', padded?=true })`.
- `Input({ label?, error?, ...TextInputProps })`.
- `Avatar({ uri?, name?, size?=44, online? })`.
- `Badge({ label, variant?: 'primary'|'success'|'error'|'muted' })`.
- `Spinner`, `Loading({ label? })`, `Divider`, `Row({ children, gap?, style? })`.
- `EmptyState({ icon?, title, subtitle?, action? })`.
- `Skeleton({ width?, height?, radius?, style? })` — shimmer.
- `Touchable` — Pressable with opacity feedback.

## Icons
`import { Heart, MessageCircle, ... } from 'lucide-react-native';` — pass `color` + `size`. (peer dep react-native-svg is installed.)

## Data layer
- API: `import api, { apiErrorMessage } from '@/lib/api';` — axios instance, baseURL already = `http://<LAN>:4000/api/v1`, auth header auto-attached, 401 refresh built in. Responses are `{ success, data, ... }` — read `res.data.data`.
- Socket: `import { getSocket, connectSocket } from '@/lib/socket';` — single shared socket. Attach with `socket.on(evt, fn)`, clean up `socket.off(evt, fn)`. Never `removeAllListeners`.
- Media URLs: `import { resolveMediaUrl } from '@/lib/env';` — turns `/media/...` into an absolute device-loadable URL. ALWAYS wrap API-returned media paths with it before putting in `<Image>`/players.

## Stores (zustand) — `@/stores/*`
- `useAuthStore` — `{ user, couple, tokens, isAuthenticated, isLoading, hydrated, login, register, logout, hydrate, setUser, setCouple }`. Partner id: `couple.partner1Id === user.id ? couple.partner2Id : couple.partner1Id`.
- `useThemeStore` — `{ currentThemeId, setTheme }`.
- Others (chat, games, notifications, call, toast, streaks, media, custom-emoji): port from `apps/web/src/stores/*` but swap `localStorage`→AsyncStorage persist via `import { zustandStorage } from '@/lib/storage'` and remove any DOM. Keep the SAME state shape and method names as the web stores.

## Routing — expo-router (files in `src/app/`)
Tab bar (bottom): **Home** `(tabs)/dashboard`, **Chat** `(tabs)/chat`, **Games** `(tabs)/games`, **Circles** `(tabs)/circles`, **More** `(tabs)/more`.
Auth group: `(auth)/login`, `(auth)/register`, `(auth)/verify`.
Stack screens (pushed from More / deep links), each its own file under `src/app/`:
`gallery`, `streaks`, `scribble`, `paint`, `emojis`, `soundboard`, `watch`, `music`, `hall-of-fame`, `profile`, `settings`, `search`, `call`, `games/[key]`, `circles/discover`, `circles/requests`, `circles/[id]`.
Navigate with `import { router } from 'expo-router'; router.push('/gallery')`. Header is hidden globally; each Screen renders its own top bar (back chevron + title) — use the shared `@/components/top-bar` `ScreenHeader` if present, else a simple Row with a back button.

## Games (parity with web)
Web games live in `apps/web/src/components/games/*` and use a `useGameSession(gameKey, onMessage)` hook over the `game:event` socket relay with host-authoritative sync (role 'a' = host). Port `use-game-session` to `@/hooks/use-game-session` (same contract, RN socket) and port each game to `@/components/games/<key>.tsx`, plus a `registry.ts`. The 17 keys: tic-tac-toe, connect-four, rock-paper-scissors, would-you-rather, partner-quiz, truth-or-dare, memory-match, pictionary, dice-duel, battleship, dots-and-boxes, reversi, hangman, emoji-riddles, mind-meld, twenty-questions, reaction-duel. Drawing games use react-native-svg. Keep all original prompt/word content.

## Realtime events (mirror `apps/web/src/components/realtime/realtime-provider.tsx`)
`message:new/read/edited/deleted`, `typing:update`, `presence:update`, `reaction:added`, `notification:new`, `call:incoming`, `soundboard:play`, `achievement:unlocked`, `watch:invite/load/state/chat/reaction`, `theme:changed`, `game:event`. A `RealtimeProvider` mounts the socket once authenticated and wires these into stores.

## Verify
After writing your files run from `c:/Users/user/Documents/linkup/mobile`:
`npx tsc --noEmit` and fix errors in YOUR files. (Ignore errors that are clearly in not-yet-created sibling files.)
