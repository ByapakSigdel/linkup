# Relationship Graveyard — Design Spec

**Date:** 2026-06-28
**Status:** Approved (direction + approach A), pending plan
**Decisions:** arc = **memorial, then her choice**; data = **purge departing partner (anonymized tombstone), keep couple/shared content as "Your partner"**; keepsake = **in-app read-only memorial (no export)**; approach = **A (memorial module + reuse solo support & existing read-only screens)**; platforms = **web + mobile parity**.

## Summary

LinkUp couples share one `couples` row joining two `users`, with shared chat, photos, important dates, and the "Constellation of Us" star-chart. There is currently **no account-deletion flow and no breakup handling**. This feature adds a compassionate offboarding: when one partner deletes their account, the surviving partner isn't dropped into a broken, 401-ing app — she's met with a gentle **memorial** of the relationship and, at her own pace, chooses to **keep going solo** (which we already support) or **wind down and leave**.

The departing partner is anonymized into a **tombstone** (PII scrubbed, login killed) rather than row-deleted, because shared content (`messages.senderId`, `couples.partner1Id/partner2Id` are `NOT NULL` FKs to `users.id`) must keep referencing a valid row. The couple's shared rows are preserved and shown to the survivor attributed to "Your partner."

This is approach **A**: a small new surface (deletion endpoint, couple lifecycle state, one memorial screen per platform) that leans on existing read-only views and the existing solo/unpaired experience.

## Goals / non-goals

**Goals:** a real, safe `DELETE /users/me`; never leave the survivor in a broken state; a dignified, on-brand memorial; reuse solo support; full web+mobile parity.

**Non-goals (v1):** data export / downloadable keepsake (explicitly out — in-app read-only only); a multi-day guided ritual; reconciliation/undo of a completed deletion; admin tooling.

## Data model (migration 0009)

`couples` — add columns:
- `endedAt timestamp` (null until ended)
- `endedByUserId uuid` references `users.id` (the departing partner)
- `survivorDecision varchar(20)` default `'pending'` — `'pending' | 'archived_solo' | 'left'`
- `survivorDecidedAt timestamp`
- Lifecycle uses existing `relationshipStatus`: active values (`dating`/`engaged`/`married`/`other`) → `'ended'`.

`users` — add columns:
- `deletedAt timestamp` (null = live account; non-null = tombstone)
- `archivedCoupleId uuid` references `couples.id` (set when a survivor chooses solo, so she can revisit the archived relationship)
- (`isActive boolean` already exists → set `false` on tombstone.)

No columns are dropped. Generate via `pnpm --filter @linkup/api db:generate`; commit the `.sql` + `meta/_journal.json` + snapshot together (prod applies the committed SQL).

## Deleter flow — `DELETE /users/me`

Controller: new route on the users module, auth-guarded, body `{ confirm: true, password }`. Rate-limited. Re-verifies the password (destructive action) before proceeding.

`UsersService.deleteAccount(userId, password)` — single transaction:
1. Load the user; verify password; if already `deletedAt` → idempotent no-op / 410.
2. **Anonymize the user (tombstone):** `email` → `deleted+<id>@linkup.invalid` (preserve unique+notNull, frees the real address for re-signup), `username` → `deleted_<shortid>`, `displayName` → `'Your partner'`, `avatarUrl/bio/phone/dateOfBirth/gender/fcmToken` → null, `passwordHash` → random unusable value, `isActive=false`, `deletedAt=now`, `coupleId=null`.
3. **Revoke all refresh tokens** for the user (`refresh_tokens.isRevoked=true`) — login dies immediately.
4. **If the user was in an active couple:** set `relationshipStatus='ended'`, `endedAt=now`, `endedByUserId=userId`, `survivorDecision='pending'`. **Do not touch shared rows.** Resolve the survivor (the other partner) and:
   - emit `couple:ended` to the survivor's userId via `EventsGateway.emitToUser`,
   - create a `relationship_ended` notification + a **gentle** FCM push ("Something in your shared space has changed — open when you're ready"), best-effort.
5. **If the user is the surviving partner of an already-ended couple** (the "leave" path): after anonymizing her, mark `couples.survivorDecision='left'`, `survivorDecidedAt=now`; since **both partners are now tombstoned**, purge the couple's shared content (messages, reactions, media, important dates, constellation stars, circle data tied to the couple) and the couple row, in FK-safe order.
6. **Solo user (no couple):** steps 1–3 only.

Return `204`. The client clears auth + routes to a goodbye screen.

Auth hardening: `validateUser`/token refresh must reject users with `deletedAt`/`isActive=false` → any stale access token resolves to 401 → client logs out cleanly (reuses the existing expiry→logout path).

## Survivor memorial flow

**Discovery:** the user/couple payload already loaded on app shell mount now carries `relationshipStatus` + `survivorDecision`. When `relationshipStatus==='ended' && survivorDecision==='pending'` for the viewer's couple, the shell routes to the **Memorial takeover** instead of the normal couple UI. The `couple:ended` realtime event sets the same flag live, surfaced on the next safe navigation (never interrupting an in-progress action mid-tap).

**Memorial takeover (new screen, web + mobile):** a calm, full-screen moment — constellation-dimming visual (brand signature; details in the frontend-design pass) — copy in sentence case, warm and specific ("Your shared space with your partner has come to rest."). Primary affordance: enter the read-only Memorial. The fork is presented gently and is never forced.

**Read-only Memorial:** reuses the existing chat, photo gallery, important-dates, and Constellation views in a read-only mode (no composer, no like/comment/edit, no new stars). Implemented by passing a `readOnly` flag through those components / gating mutations on `relationshipStatus==='ended'`.

**Fork (always available, never auto-applied):**
- **Keep going on your own** → `survivorDecision='archived_solo'`, `survivorDecidedAt=now`; set the survivor's `coupleId=null`, `archivedCoupleId=couple.id`. She enters the existing solo/unpaired experience unchanged (invariant preserved: `coupleId!=null` still means "actively paired"). A "Memories" entry (shown when `archivedCoupleId` is set) reopens the read-only Memorial anytime. Shared data preserved read-only forever.
- **Wind down & leave** → confirm dialog → `DELETE /users/me` (the survivor path above) → both gone → shared content purged → goodbye screen + logout.

## Realtime & notifications
- New gateway event `couple:ended` (payload `{ coupleId, endedAt }`) → survivor userIds via existing `emitToUser`.
- New notification type `relationship_ended` via `NotificationsService` + best-effort FCM, gentle wording per the constraint that pushes are OS-rendered notification messages.

## Client gating summary
- "Actively paired" UI ⇔ `coupleId != null` **and** `couple.relationshipStatus !== 'ended'`.
- `relationshipStatus==='ended' && survivorDecision==='pending'` ⇒ Memorial takeover.
- `archivedCoupleId != null` ⇒ solo experience + a "Memories" archive entry.
- Settings (both platforms) gains a "Delete account" action that opens the confirm (password) dialog.

## Error handling
- Delete is transactional; partial anonymization can't persist on failure.
- Password mismatch → 401; missing `confirm` → 400; already-deleted → idempotent.
- Purge (both-gone) runs in FK-safe order inside the transaction; if it fails, the deletion rolls back (survivor stays "left"-pending) rather than half-purging.
- Deleted-user tokens always rejected.

## Testing
- **Backend unit:** anonymization scrubs all PII + revokes tokens + keeps FKs valid + preserves shared rows; couple→`ended` with `endedByUserId`/`pending`; `archived_solo` (coupleId null, archivedCoupleId set, data preserved); `left` when partner already gone → shared content purged in FK-safe order; guards (double-delete idempotent, deleted user cannot authenticate, wrong password rejected).
- **Manual (test accounts):** dean deletes → ayusha gets gentle push → opens → Memorial takeover → browses read-only chat/photos/dates/constellation → (a) "keep going solo" lands in solo mode with a working Memories archive, or (b) "leave" → goodbye + logout, and the couple's shared data is purged.

## Open questions
None blocking. Defaults chosen: password re-entry required on delete; gentle non-alarming push wording; shared data purged only once both partners are gone. Revisit if desired.
