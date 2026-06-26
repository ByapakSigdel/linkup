# Circles Upgrade — Design Spec

**Date:** 2026-06-24
**Status:** Approved (direction + scope), pending build
**Decisions:** DMs = **mutuals-only, couple-to-couple**; scope = **full sweep** (DMs + all high & medium optimizations).

## Summary

Circles (LinkUp's "Instagram-for-couples": one profile per couple, one-way follow, public default) is feature-complete for v1 — profiles, feed, photo/carousel posts, likes, comments, follow/requests, 24h stories with views, discover, near-perfect web/mobile parity, good DB indexing + keyset pagination. This upgrade does two things: **(Phase 1)** fix the real optimization/UX gaps, and **(Phase 2)** add a **couple-to-couple Direct Message** feature it currently lacks.

Built in two phases so Phase 1 ships value fast and Phase 2 (the larger feature) builds on a clean base. Each phase gets its own implementation plan.

Key existing files (from analysis): backend `apps/api/src/modules/circles/{circles.controller,circles.service}.ts` + schema `apps/api/src/database/schema/index.ts:388-568`; web `apps/web/src/app/(dashboard)/circles/*`; mobile `mobile/src/app/(app)/circles.tsx`, `mobile/src/app/circles/*`, `mobile/src/components/circles/*`; shared infra `apps/api/src/gateway/events.gateway.ts` (`emitToUser` is public + arbitrary-user), `apps/api/src/modules/notifications/notifications.service.ts`, media `apps/api/src/modules/media/{media,storage}.service.ts`.

---

## Phase 1 — Optimizations (high + medium)

### 1.1 Image pipeline (HIGH — biggest non-DM win)
Today full-resolution originals are served everywhere; the `media.thumbnails`/`variants` columns exist but are never populated, and clients use RN core `Image` with no caching.
- **Server:** in `media.service.ts`/`storage.service.ts`, on image upload generate downscaled variants (e.g. `thumb` ~256px, `medium` ~1080px) with `sharp`, store them, and populate `media.thumbnails`/`variants` (+ return them in the media payload). Keep the original. Non-images unaffected. `sharp` is a native dep — ensure it installs in the prod `node:20-bookworm-slim` image (add to api deps; rebuild).
- **Clients:** switch circles media to `expo-image` (mobile) with disk cache + `recyclingKey`; request the **thumb** variant in `PostGrid` + `StoryRing` avatars and the **medium** variant in the feed; full/original only in the lightbox. Web: use the variants similarly + `loading="lazy"`. Files: `mobile/src/components/circles/{post-media,post-grid,story-ring}.tsx` (+ web equivalents).
- Backfill is not required (old posts keep serving originals); variants apply to new uploads. Optionally a one-off backfill later.

### 1.2 Discover N+1 (HIGH)
`discover()` runs a per-row `resolveFollowState` query. Replace with a single `leftJoin` on `circleFollows` to compute follow state in the main query. File: `circles.service.ts` (~1541-1556).

### 1.3 Pull-to-refresh on all mobile Circles lists (MEDIUM)
Add `RefreshControl` to: home feed (`mobile/src/app/(app)/circles.tsx`), discover (`circles/discover.tsx`), profile (`circles/[id].tsx`), requests (`circles/requests.tsx`).

### 1.4 Virtualized profile grid + infinite scroll (MEDIUM)
Convert the profile post grid from an eager `ScrollView` + "Load more" button to a paginated `FlatList` (mobile) with `onEndReached` infinite scroll, matching the home feed. Mirror on web. File: `mobile/src/app/circles/[id].tsx` (+ web `circles/[id]/page.tsx`).

### 1.5 Post-delete UI (MEDIUM)
Wire the existing `deletePost` API into an owner-only affordance (overflow/long-press in the post grid lightbox and feed card → confirm → delete + optimistic remove). Files: `mobile/src/components/circles/{post-grid,feed-post-card}.tsx` (+ web).

### 1.6 Followers / Following lists (MEDIUM)
Add list screens consuming the existing `getFollowers`/`getFollowing` endpoints; make the follower/following `Stat` blocks on the profile tappable. Files: new `circles/[id]/followers` + `following` screens (or a tabbed sheet) on both platforms; `profile-header.tsx`.

### 1.7 Cover image (MEDIUM)
Render `coverImageUrl` as a profile banner and add it to the edit form (it's already in schema + serialized). Files: `mobile/src/components/circles/profile-header.tsx` + the edit form in `circles/[id].tsx` (+ web).

### 1.8 Transactional counters (correctness)
Wrap the multi-statement counter mutations (follow/unfollow/acceptRequest/toggleLike/createPost/deletePost) in `db.transaction` so `followerCount`/`postCount`/etc. can't drift on a mid-sequence failure. File: `circles.service.ts`.

### 1.9 Polish (low, include where cheap)
Double-tap-to-like on feed media; feed videos autoplay muted; debounce `StoryRing` refetch on bursty `circle:story:new`/`circle:self:updated` events. Files: `feed-post-card.tsx`, `post-media.tsx`, `story-ring.tsx`.

---

## Phase 2 — Circles DM (mutuals-only, couple-to-couple)

A conversation is between two **circles** (couples); since each circle is 2 people, a thread has up to 4 participants and every message fans out to all of them. **Only mutual follows** (both circles follow each other, status accepted both ways) may open or send in a conversation — enforced server-side; the "Message" button is shown/enabled only for mutuals.

### Data model (new tables + migration)
- `circle_conversations`: `id, circleAId, circleBId` (store as an ordered pair with a unique index on the ordered `(min,max)` so find-or-create is race-safe), `lastMessageAt`, `lastMessagePreview`, timestamps.
- `circle_conversation_messages`: `id, conversationId (fk, indexed (conversationId, createdAt)), senderUserId, senderCircleId, content, mediaUrls (jsonb), createdAt`.
- `circle_conversation_reads`: `id, conversationId, circleId (or userId), lastReadAt` — for unread counts per circle/user.

### Backend (extend the circles module, or a `circle-dm` submodule)
- `GET /circles/conversations` — list the caller's circle's conversations (cursor, with other-circle profile summary + lastMessage + unread count).
- `POST /circles/:idOrHandle/conversations` — find-or-create a conversation with that circle; **403 unless mutual follow**.
- `GET /circles/conversations/:id/messages` — paginated (keyset), participant-only.
- `POST /circles/conversations/:id/messages` — send (text + optional mediaUrls via the existing upload), participant-only; updates `lastMessageAt`/preview; fans out + notifies.
- `POST /circles/conversations/:id/read` — mark read (updates the caller's circle read row).
- Realtime: new gateway events `circle:dm:new`, `circle:dm:read`, `circle:dm:typing`, delivered via the existing `emitToUser` to all participant userIds (resolve via the existing `coupleUserIds` helper). Reuse `NotificationsService` (`circle_dm` type) + FCM push (best-effort, like the message push) when a recipient is offline.

### Clients (web + mobile parity)
- A **conversations list** screen (inbox) reachable from the Circles home header (with an unread badge).
- A **thread** screen: message list (keyset, reverse), composer (text + image), typing indicator, read receipts, realtime via the new events. Reuse the existing chat UI/store as a template.
- A **Message** button on `profile-header.tsx`, shown only when mutual-follow; tapping find-or-creates the conversation and opens the thread.
- Unread badges on the inbox entry + Circles nav.

### Auth / spam
Mutual-follow gate enforced in the service for open + send. No message-request inbox (mutuals-only makes it unnecessary). A conversation persists even if a follow is later removed (history stays), but sending re-checks mutual status (configurable — default: keep allowing existing conversations).

---

## Non-goals / out of scope
Group DMs (3+ circles), message reactions/edit/delete in DM v1 (can follow), voice notes in DM, full image-variant backfill of historical posts, video transcoding.

## Testing
- Phase 1: backend unit test the discover join + the transactional counter paths; manual two-account check of pull-to-refresh, grid infinite scroll, post-delete, followers/following, cover image, and that new uploads serve smaller variants.
- Phase 2: backend unit tests for the mutual-follow gate (open/send rejected for non-mutuals) + find-or-create idempotency (ordered-pair unique); manual two-couple (4 accounts, or 2) DM walkthrough: open from a mutual profile, send text+image, read receipts, typing, realtime delivery + push when offline, unread badges.

## Open questions
None blocking. Image-variant sizes (256/1080) and whether existing conversations survive an un-follow are set to sensible defaults above; revisit if desired.
