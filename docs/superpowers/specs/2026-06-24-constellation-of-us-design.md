# Constellation of Us — Design Spec

**Date:** 2026-06-24
**Status:** Approved (experience + technical), pending spec review
**Author:** brainstormed with the LinkUp owner

## Summary

A signature couples game for LinkUp: a **living, shared night sky** that grows one
star at a time as the two partners answer prompts about each other and their
relationship. It is simultaneously a game (guess each other, complete
constellations) and a keepsake (a beautiful, persistent artifact of the
relationship). It leans into LinkUp's existing brand identity — "a star-chart for
two" — and becomes the visual centerpiece of the Games tab.

This is the **first of a phased set** of personality-rich couple games brainstormed
on 2026-06-24. The others are deferred (see *Out of scope*).

## Goals

- A distinctive, on-brand game that no competitor has — about *this* couple
  specifically, not generic arcade filler.
- Spans the four directions the owner wants: **deepen intimacy**, **playful
  competition** (guess-me), **cozy collaborative ritual**, and **async /
  long-distance friendly**.
- "One signature game, done beautifully": fully designed, persisted, polished —
  quality over quantity.
- Web + mobile parity, reusing existing infrastructure (gateway relay, media
  upload, presence, push, theming).

## Experience

### The sky
A pannable / zoomable starfield, themed (default = the midnight constellation
theme; adapts to all 6 themes). Empty/early state shows faint **pending** star
outlines hinting at the constellations waiting to be filled — a treasure map of
the relationship to discover. A progress line reads e.g. "14 stars lit · 1
constellation complete" with a **+ Light a new star** action.

- New answers arrive as a **shooting star** that settles into place.
- Completing all (non-optional) prompts in a constellation animates the **lines**
  connecting its stars and reveals the constellation's **name**.
- Subtle twinkle. All motion respects the `reduceMotion` accessibility setting.
- Tap a star → its memory opens (both answers, date, optional photo); editable
  forever.

### Constellations (prompt themes)
`Firsts` · `Inside Jokes` · `Little Things` · `What I Admire` · `Dreams` ·
`Hard Times We Survived` · `Just Us` (spicy, tap-to-unlock).

### Three kinds of star
1. **Shared memory** — both partners write their side of one moment ("our first
   kiss — where, and what you remember"). Two perspectives, one star.
2. **Guess me** *(the game hook)* — one partner answers about themselves; the
   other **guesses**; on reveal both answers show and the pair taps **"Nailed it ✓
   / So close"** (self-judge — works for any free-text prompt, no brittle
   matching). Matches feed a gentle "you know each other 82%" read and the star
   twinkles gold on a match.
3. **Write your own** — a custom star for anything the deck didn't capture.

### Pacing — "both"
- A gentle **daily highlighted prompt** (deterministic pick from un-lit prompts,
  seeded by date + coupleId — no extra server state), **plus**
- the **full deck** always browsable for couples who want more in one sitting.

### Async by default (long-distance friendly)
Answer any time. A guess/shared star fully **lights** once *both* partners have
done their part. When a partner contributes, the other gets a soft push nudge
("✨ Kai added a star") and sees it appear live if both are in the screen.

## Architecture

### Data model — new table `constellation_stars`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| coupleId | uuid fk → couples | |
| constellationKey | varchar | e.g. `firsts`, `dreams`, `custom` |
| promptKey | varchar nullable | curated prompt id; null for custom |
| kind | varchar | `shared` \| `guess` \| `custom` |
| title | varchar | denormalized prompt title / custom title |
| status | varchar | `pending` \| `lit` |
| answers | jsonb | shape varies by kind (below) |
| photoUrl | varchar nullable | optional memory photo |
| posX, posY | real | assigned on creation (seeded jitter within the constellation's region) so layout is stable |
| createdBy | uuid fk → users | |
| litAt | timestamp nullable | set when status → lit |
| createdAt, updatedAt | timestamp | |

`answers` jsonb shapes:
- **shared**: `{ "<userId>": { text }, "<partnerId>": { text } }`
- **guess**: `{ subjectId, answer: { text }, guess: { by, text }, matched: bool|null }`
- **custom**: `{ "<userId>": { text } }`

A star is `lit` when: custom/solo → on first write; shared → both texts present;
guess → both answer and guess present.

### Prompts live in code (not a table)
A shared-shape constants deck (mobile + web): `constellations[]` (key, name,
region/order) and `prompts[]` (key, constellationKey, kind, title, tier). Target
**~6 constellations × ~8 prompts ≈ 48 curated prompts**, tiered warm → deep, with
the `Just Us` spicy tier tap-gated. Constellation completion + line-drawing is
computed client-side from the deck + lit stars. Custom stars carry their own
title and a `custom` constellation/region.

### Backend — new `constellation` module (NestJS)
- `GET /constellation` → `{ stars: ConstellationStar[] }` for the caller's couple.
- `POST /constellation/stars` → add/answer a prompt. Upsert by
  `(coupleId, promptKey)` for curated prompts; insert for custom. Merges the
  caller's contribution into `answers`, recomputes `status`, assigns `posX/posY`
  on first creation, sets `litAt` when lighting. Returns the star.
- `PATCH /constellation/stars/:id` → edit a contribution, attach a photo, or set
  `matched` (the "Nailed it" tap). Couple-scoped auth.
- Realtime: on create/update/light, relay `constellation:star` (the star payload)
  to the partner via the existing gateway relay pattern, and send an FCM nudge
  ("✨ <name> lit a new star") reusing the push service.
- Module placement: a dedicated `modules/constellation/` (controller + service),
  mirroring existing module conventions.

### Clients (web + mobile parity)
- `constellation-store` (Zustand): `stars[]`, `loading`, `fetch()`, optimistic
  `upsertStar()`, `applyRemote()` for the relayed event.
- **SkyView** centerpiece: **SVG-based** pan/zoom starfield (mobile:
  `react-native-svg` + `react-native-gesture-handler`/`reanimated`; web: SVG +
  CSS/motion). Renders lit stars, dim pending stars, constellation lines + labels
  on completion, twinkle, shooting-star arrival. Reduce-motion aware. Crisp and
  themeable.
- Prompt/answer flow: daily-highlight card + deck browser (grouped by
  constellation, tier-gated `Just Us`), per-kind answer UI.
- Star-detail sheet: reveal both answers, edit, add/replace photo, guess-me
  "Nailed it / So close".
- Progress header ("N stars lit · M constellations complete", "you know each
  other X%").
- Reuses: media upload (star photos), gateway relay, presence (`partnerHere`),
  push, theme tokens.

### Registry integration
Register `constellation-of-us` in the existing `registry.ts` (both platforms) as
the lead entry in the couple category, so it appears in the Games hub. Existing
stock games (Tic-Tac-Toe, Connect Four, Battleship, Reversi, Dice, Hangman, etc.)
get tucked under an "Arcade" sub-section so the personality games lead. The
existing `useGameSession` relay is not required (this game uses its own
persisted endpoints + the `constellation:star` relay), but presence reuse is fine.

## Build scope / phasing (internal)
Ships as one polished game, built in order:
1. DB migration (`constellation_stars`) + Drizzle schema.
2. Backend `constellation` module (GET/POST/PATCH + relay + push nudge).
3. Curated prompt deck (~48 prompts, 6 constellations + custom).
4. Mobile: store, SkyView, prompt flow, star detail, daily highlight + deck,
   progress, constellation-completion animation.
5. Web parity.
6. Polish pass (frontend-design): starfield aesthetic per theme, animations,
   empty state.

## Error handling / edge cases
- Not paired → the game shows a "link up to start your sky" empty state (mirrors
  chat's unpaired state).
- Offline / failed save → optimistic update reverts + a toast (matches the
  app-wide pattern just added).
- Editing a lit star keeps it lit; clearing a required contribution can revert to
  `pending` (or keep lit — default: keep lit once earned).
- Duplicate answer to an already-answered curated prompt updates in place (upsert
  by promptKey), never creates duplicates.
- Photos reuse the existing media pipeline (size/limit already handled).

## Testing
- Backend: unit-test the status-transition logic (pending → lit per kind) and the
  upsert-by-promptKey behavior; couple-scoped auth on all endpoints.
- Client: the deterministic daily-prompt pick; star placement stability;
  constellation-completion detection from deck + stars.
- Manual: two-account walkthrough (answer a guess-me on each side → lights + push
  nudge → reveal + self-judge), across at least the default + one other theme.

## Out of scope (phased for later)
The rest of the brainstormed set, in rough priority: **The Question Deck +
Memory Jar**, **The Wager (IOU ledger)**, then the cozy/async set (**Our Map**,
**Time Capsule**, **Tag You're It**, **Storyweave**), plus elevating the stock
**Truth or Dare** into a tiered "Spicy Deck". Each gets its own spec when picked up.

## Open questions
None blocking. Visual polish specifics (exact star art, per-theme palettes,
animation curves) are deferred to the frontend-design polish pass at build time.
