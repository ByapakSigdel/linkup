export const meta = {
  name: 'linkup-mobile-features',
  description: 'Port every LinkUp web feature to RN screens (build + RN-correctness verify, per feature)',
  phases: [{ title: 'Build' }, { title: 'Verify' }],
}

const ROOT = 'c:/Users/user/Documents/linkup'
const MOBILE = ROOT + '/mobile'
const WEB = ROOT + '/apps/web/src'

const PREAMBLE = `You are porting a LinkUp web feature to the React Native app (Expo SDK 56, expo-router, TS strict) at ${MOBILE}.
FIRST read ${MOBILE}/CONTRACT.md fully. STABLE shared modules to consume (do NOT recreate): @/lib/{env,api,socket,storage}, @/types, @/theme (useTheme/useColors), @/components/ui (Screen, AppText, Heading, Muted, Button, Card, Input, Avatar, Badge, Spinner, Loading, Divider, Row, EmptyState, Skeleton, Touchable), @/components/top-bar (ScreenHeader, AppBar), @/components/realtime-provider, @/hooks/{use-socket,use-game-session,use-theme-sync}, and the stores @/stores/{auth-store,theme-store,chat-store,games-store,notifications-store,call-store,toast-store,streaks-store,media-store,custom-emoji-store}.
PORTING METHOD: open the cited web file(s) under ${WEB} and reproduce the SAME behavior, data calls, copy, and states in idiomatic RN. Read res.data.data from the API. Wrap API media paths with resolveMediaUrl().
RULES: No web-isms (className/Tailwind/'use client'/DOM/localStorage/next/<div>). RN primitives + UI kit only. Theme tokens via useTheme() — NEVER hardcode hex. Every screen: loading + empty + error + happy path, with at least one tasteful animation (reanimated) or skeleton. expo-router default export per route file.`

const BUILD_SCHEMA = {
  type: 'object',
  required: ['filesCreated', 'tscClean', 'summary'],
  additionalProperties: false,
  properties: {
    filesCreated: { type: 'array', items: { type: 'string' } },
    tscClean: { type: 'boolean' },
    summary: { type: 'string' },
  },
}
const VERIFY_SCHEMA = {
  type: 'object',
  required: ['tscClean', 'noWebIsms', 'themeTokensOnly', 'parity', 'fixesApplied', 'remainingIssues'],
  additionalProperties: false,
  properties: {
    tscClean: { type: 'boolean' },
    noWebIsms: { type: 'boolean' },
    themeTokensOnly: { type: 'boolean' },
    parity: { type: 'boolean' },
    fixesApplied: { type: 'array', items: { type: 'string' } },
    remainingIssues: { type: 'array', items: { type: 'string' } },
  },
}

const SPECS = [
  {
    key: 'auth',
    task: `Build the auth screens (OVERWRITE the foundation stubs). Port from ${WEB}/app/(auth)/login/page.tsx, register/page.tsx, verify/page.tsx.
Files: src/app/(auth)/login.tsx, src/app/(auth)/register.tsx, src/app/(auth)/verify.tsx.
Use useAuthStore.login/register. Branded hero (LinkUp wordmark/logo — recreate a simple constellation mark with react-native-svg or text), animated entrance, loading button states, inline error from apiErrorMessage, keyboard handling (KeyboardAvoidingView). On success route to /(tabs)/dashboard via expo-router. Register collects email/username/displayName/password (+ optional dateOfBirth). Verify shows the code flow if present.`,
  },
  {
    key: 'dashboard',
    task: `Build the Home screen (OVERWRITE stub). Port ${WEB}/app/(dashboard)/dashboard/page.tsx — the "useful home": partner online/last-seen status, couple name, quick stats (streak, days together, message/media counts from couple), quick actions to key features, anniversary/important dates if shown. File: src/app/(tabs)/dashboard.tsx. Use AppBar header, Cards, Skeletons while loading, presence from chat-store/auth couple.`,
  },
  {
    key: 'chat',
    task: `Build full Chat parity. Port ${WEB}/app/(dashboard)/chat/page.tsx and ALL of ${WEB}/components/chat/* (message-list, message-bubble, message-input, chat-header, typing-indicator, highlight-picker, media-message) and ${WEB}/components/reactions/* (stickers + reaction glyphs — recreate sticker SVGs with react-native-svg or simple shapes).
Files: src/app/(tabs)/chat.tsx and src/components/chat/*.tsx (mirror the web component split). Use FlatList (inverted) for messages, use-socket for send/typing/read, realtime updates from chat-store, message bubbles themed (messageSent/messageReceived), reactions long-press menu, reply/edit/delete actions, scribble messages render the image (resolveMediaUrl), media via expo-image. Chat header shows partner + call buttons (voice/video/screen) that call into call-store/useCall (a startCall helper — create src/hooks/use-call.ts porting ${WEB}/hooks/use-call.ts shape, emitting call socket events; actual WebRTC media handled by the calls feature, but wire the buttons + navigation to /call). Input supports text + attach (expo-image-picker) + emoji.`,
  },
  {
    key: 'gallery',
    task: `Build Gallery. Port ${WEB}/app/(dashboard)/gallery/page.tsx + ${WEB}/components/media/*. File: src/app/gallery.tsx (+ src/components/media/*.tsx as needed). Grid of photos (FlatList numColumns) using expo-image + resolveMediaUrl, upload via expo-image-picker (POST to the same media endpoint the web uses — check the web upload call), albums if present, full-screen viewer on tap, favorite toggle, loading skeletons, empty state. ScreenHeader with back.`,
  },
  {
    key: 'streaks',
    task: `Build Streaks. Port ${WEB}/app/(dashboard)/streaks/page.tsx. File: src/app/streaks.tsx. Show current/longest streak, status, freezes, recent photos, animated flame/number. Use streaks-store/api as the web does. ScreenHeader.`,
  },
  {
    key: 'profile-settings-search',
    task: `Build Profile, Settings, Search.
- src/app/profile.tsx — port ${WEB}/app/(dashboard)/profile/page.tsx: avatar, display name, couple info, edit profile, change couple name (PATCH as web does), logout button.
- src/app/settings.tsx — port ${WEB}/app/(dashboard)/settings/page.tsx INCLUDING the theme selector: list all 6 themes from @/theme themes with swatches; tapping sets useThemeStore.setTheme AND persists to the couple (PATCH sharedThemeId) and emits 'theme:changed' like web. Other settings toggles as in web.
- src/app/search.tsx — port ${WEB}/app/(dashboard)/search/page.tsx + ${WEB}/components/search/*: search messages/media/etc., results list, empty state.`,
  },
  {
    key: 'scribble-paint',
    task: `Build the drawing screens with react-native-svg + react-native-view-shot.
- src/app/scribble.tsx (+ src/components/creative/scribble-canvas.tsx) — port ${WEB}/app/(dashboard)/scribble/page.tsx + ${WEB}/components/creative/scribble-canvas.tsx. A finger-drawing canvas: capture strokes via PanResponder/gesture-handler into SVG <Path> d-strings; color + brush size; clear/undo. LIVE relay to partner over the socket scribble events (read the web component for event names + RemoteScribbleStroke shape) so both draw on a shared canvas; render remote strokes too. "Send to chat" captures the canvas with captureRef (react-native-view-shot) and uploads as a scribble message (match the web's send call).
- src/app/paint.tsx (+ src/components/creative/paint-canvas.tsx) — port ${WEB}/app/(dashboard)/paint/page.tsx + paint-canvas.tsx similarly (richer palette/tools).`,
  },
  {
    key: 'emojis-soundboard',
    task: `Build:
- src/app/emojis.tsx — port ${WEB}/app/(dashboard)/emojis/page.tsx + ${WEB}/components/emojis/* + custom-emoji-store: list custom emojis, create one (image pick/upload), use the same API calls as web.
- src/app/soundboard.tsx — port ${WEB}/app/(dashboard)/soundboard/page.tsx + ${WEB}/components/soundboard/*: grid of sound buttons; tapping plays locally via expo-audio AND emits 'soundboard:play' to partner (match web); create sound (record/upload) as web does.`,
  },
  {
    key: 'watch',
    task: `Build Watch Party with sync. Port ${WEB}/app/(dashboard)/watch/page.tsx + ${WEB}/components/watch/*. File: src/app/watch.tsx (+ src/components/watch/*).
Player supports BOTH YouTube (react-native-youtube-iframe) and direct video URLs (expo-video) — mirror the web resolveWatchSource logic (youtube id/link → iframe; other http(s) → native video). One control surface; host-authoritative sync over watch:load/state events (port the page's emit/apply logic, with the same applyingRemote guard). Side chat panel (watch:chat) + floating reactions (watch:reaction). History list + start/end party via the same /entertainment/watch endpoints.`,
  },
  {
    key: 'music',
    task: `Build Music. Port ${WEB}/app/(dashboard)/music/page.tsx + ${WEB}/components/music/*. File: src/app/music.tsx. Synced listening like the web (YouTube/direct as supported), now-playing, queue/history, controls. Use the same /entertainment or /music endpoints the web calls. expo-audio/expo-video + youtube-iframe as needed.`,
  },
  {
    key: 'circles',
    task: `Build Circles (Instagram-for-couples) parity. Port ${WEB}/app/(dashboard)/circles/page.tsx, circles/[id]/page.tsx, circles/discover/page.tsx, circles/requests/page.tsx and ALL ${WEB}/components/circles/*.
Files: src/app/(tabs)/circles.tsx (home feed + your circle), src/app/circles/[id].tsx (a circle profile: grid, follow/unfollow, stories), src/app/circles/discover.tsx, src/app/circles/requests.tsx, and src/components/circles/*.tsx. Use the circles API (port the calls from ${WEB}/lib/circles-api.ts into src/lib/circles-api.ts). Story rings/viewer, post grid (FlatList numColumns), like/comment, follow states, create post (image picker). Loading skeletons + empty states throughout.`,
  },
  {
    key: 'hall-of-fame',
    task: `Build Hall of Fame. Port ${WEB}/app/(dashboard)/hall-of-fame/page.tsx + ${WEB}/components/achievements/*. File: src/app/hall-of-fame.tsx. Achievement cards by category, unlocked/locked states, progress, celebratory animation on new ones. Same API as web.`,
  },
  {
    key: 'more-menu',
    task: `Build the More tab menu (OVERWRITE stub) listing every non-tab feature with icons, grouped like the web sidebar (${WEB}/components/layout/sidebar.tsx): Studio (Scribble, Paint, Emojis, SoundBoard), Side by side (Watch Party, Music), Your circle (Hall of Fame, Discover), plus Gallery, Streaks, Profile, Settings, Search. File: src/app/(tabs)/more.tsx. Each row navigates via router.push to the right route. Show couple/profile header at top. Themed, with section labels.`,
  },
  {
    key: 'games-set-1',
    task: `Port 5 games to RN from ${WEB}/components/games/: tic-tac-toe, connect-four, rock-paper-scissors, dice-duel, memory-match. Create src/components/games/<key>.tsx for each, exporting the SAME component name as web. Use @/hooks/use-game-session (same contract). Reproduce the host-authoritative sync EXACTLY (role 'a' host owns state, sync/action/hello/reset messages). Convert JSX to RN (View/Pressable/AppText), boards via Views or react-native-svg. Theme tokens only. Keep all original content. Waiting-for-partner state when !partnerHere.`,
  },
  {
    key: 'games-set-2',
    task: `Port 5 games to RN from ${WEB}/components/games/: would-you-rather, partner-quiz, truth-or-dare, mind-meld, twenty-questions. Create src/components/games/<key>.tsx each (same exported names). Use @/hooks/use-game-session, port host-authoritative sync + hidden-info handling exactly. RN primitives, theme tokens, original content, waiting state.`,
  },
  {
    key: 'games-set-3',
    task: `Port these games to RN from ${WEB}/components/games/: battleship, reversi, dots-and-boxes (the board-heavy ones). Create src/components/games/<key>.tsx each (same names). Use @/hooks/use-game-session; render boards/grids with react-native-svg or View grids + Pressable cells. Port sync + hidden-info (battleship secret boards) exactly. Theme tokens only.`,
  },
  {
    key: 'games-set-4',
    task: `Port these games to RN from ${WEB}/components/games/: hangman, emoji-riddles, pictionary. Create src/components/games/<key>.tsx each (same names). Pictionary: drawing via react-native-svg paths relayed through the game session (port the web stroke relay through use-game-session, NOT the scribble socket). Use @/hooks/use-game-session, port sync + hidden-info. Theme tokens, original content.`,
  },
  {
    key: 'games-shell',
    task: `Build the games registry + lobby + route. Port ${WEB}/components/games/registry.ts to src/components/games/registry.ts (same GAMES array: key/name/tagline/emoji/category/Component for all 17, importing the RN game components by their exported names; same CATEGORY_LABELS + getGame). Build src/app/(tabs)/games.tsx (lobby, OVERWRITE stub) porting ${WEB}/app/(dashboard)/games/page.tsx: games grouped by category, partner-in-game banner (games-store), "Here" badges. Build src/app/games/[key].tsx porting ${WEB}/app/(dashboard)/games/[key]/page.tsx: useLocalSearchParams key, getGame, ScreenHeader with game name + back, render the game Component, not-paired/not-found fallbacks. Emoji can render as AppText.`,
  },
]

phase('Build')
log('Porting ' + SPECS.length + ' feature units to RN (build → verify per feature)')

const results = await pipeline(
  SPECS,
  (spec) =>
    agent(PREAMBLE + '\n\nYOUR FEATURE: ' + spec.key + '\n' + spec.task +
      `\n\nWhen done run \`cd ${MOBILE} && npx tsc --noEmit\` and fix every error in YOUR files (ignore errors clearly in other features' not-yet-written files). Report.`,
      { label: 'build:' + spec.key, phase: 'Build', schema: BUILD_SCHEMA, agentType: 'general-purpose', effort: 'high' }),
  (build, spec) =>
    agent(PREAMBLE + '\n\nADVERSARIAL VERIFY for feature: ' + spec.key +
      '\nThe build agent created: ' + (build ? build.filesCreated.join(', ') : '(build failed — create/repair per the task)') +
      '\nTask was:\n' + spec.task +
      `\n\nAudit the created files and FIX issues directly:
1. NO web-isms: no className, Tailwind, 'use client', document/window, localStorage, next/*, or <div>/<span> — only RN components.
2. Theme tokens only via useTheme() — no hardcoded hex (except inside react-native-svg art where unavoidable; prefer tokens).
3. Uses the shared UI kit + top-bar; expo-router default export; navigation via expo-router.
4. Parity with the web file(s) for this feature: same data calls (res.data.data), same key behaviors/states, same copy where reasonable; loading + empty + error states present; at least one animation/skeleton.
5. Correct use of @/lib/api, resolveMediaUrl for media, getSocket for realtime, use-game-session for games (host-authoritative sync intact).
Then run \`cd ${MOBILE} && npx tsc --noEmit\` and fix every error in these files. Return honestly.`,
      { label: 'verify:' + spec.key, phase: 'Verify', schema: VERIFY_SCHEMA, agentType: 'general-purpose', effort: 'high' })
      .then((verify) => ({ key: spec.key, build, verify })),
)

const done = results.filter(Boolean)
log('Features done. tscClean(verify): ' + done.filter((r) => r.verify && r.verify.tscClean).length + '/' + done.length)
return done.map((r) => ({
  key: r.key,
  tscClean: r.verify && r.verify.tscClean,
  noWebIsms: r.verify && r.verify.noWebIsms,
  parity: r.verify && r.verify.parity,
  remainingIssues: (r.verify && r.verify.remainingIssues) || ['verify null'],
}))
