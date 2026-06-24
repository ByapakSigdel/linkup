# Constellation of Us — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build "Constellation of Us" — a persistent, shared star-chart that grows as a couple answers prompts about each other (intimacy game + keepsake), on web and mobile.

**Architecture:** New `constellation_stars` Postgres table + a small NestJS `constellation` module (REST GET/POST/PATCH, couple-scoped). Prompts live as client-side constants (no prompts table); a star "lights" when both partners contribute. Realtime nudges relay via the existing `EventsGateway.emitToUser` + an FCM push. Clients (web + mobile) render an SVG pan/zoom starfield from a Zustand store.

**Tech Stack:** NestJS 10 + Drizzle (postgres-js) · Socket.IO · React Native (Expo SDK 56) + react-native-svg 15 + reanimated 4 + gesture-handler 2 · Next.js 15 (web) · Zustand.

## Global Constraints

- **Web + mobile parity** — every user-facing capability ships on both `apps/web` and `mobile`.
- **Mobile is OUTSIDE the pnpm workspace** (npm-managed) — it cannot import `packages/*`; the prompt deck is duplicated in `mobile/` and `apps/web/`, mirroring the existing duplicated `registry.ts`.
- **Couple-scoped auth** — every endpoint resolves the caller's `coupleId` from the JWT user and rejects access to other couples.
- **No hardcoded colors** — all UI reads theme tokens via `useTheme()` (mobile) / theme context (web); must look correct across all 6 themes.
- **Reduce-motion aware** — all animations check the user's `reduceMotion` setting and fall back to instant/no-motion.
- **Commits:** commit + push to `main` after each task. Commit messages use `git -c user.name="ByapakSigdel"` and **no Claude co-author trailer**.
- **Prod API transpiles** (`TS_NODE_TRANSPILE_ONLY=true`) — pre-existing strict-null errors in unrelated files are tolerated; do not "fix" them here.
- **Mobile release:** bump `mobile/src/lib/env.ts` `APP_BUILD` when cutting the APK (handled at release, not per task).

---

## File structure

**Backend (`apps/api/`)**
- Modify `src/database/schema/index.ts` — add `constellationStars` table + relations.
- Generate `src/database/migrations/0006_*.sql` (drizzle-kit).
- Create `src/modules/constellation/constellation.service.ts` — DB ops + status logic + relay/push.
- Create `src/modules/constellation/constellation.controller.ts` — GET/POST/PATCH.
- Create `src/modules/constellation/constellation.module.ts`.
- Create `src/modules/constellation/constellation.service.spec.ts` — unit tests for status logic.
- Modify `src/app.module.ts` — register `ConstellationModule`.

**Shared deck (duplicated)**
- Create `mobile/src/components/games/constellation/deck.ts`
- Create `apps/web/src/components/games/constellation/deck.ts` (identical content)

**Mobile (`mobile/`)**
- Create `src/stores/constellation-store.ts`
- Create `src/components/games/constellation/sky-view.tsx`
- Create `src/components/games/constellation/prompt-sheet.tsx`
- Create `src/components/games/constellation/star-detail.tsx`
- Create `src/components/games/constellation/index.tsx` (the `ConstellationOfUs` screen component)
- Modify `src/components/games/registry.ts` — register the game.

**Web (`apps/web/`)** — parity mirrors of the four components + store + registry entry.

**Types**: shared TS interfaces are duplicated in each client's `constellation/types.ts` (mobile cannot import `packages/types`).

---

## Task 1: Database table `constellation_stars`

**Files:**
- Modify: `apps/api/src/database/schema/index.ts`
- Generate: `apps/api/src/database/migrations/0006_*.sql`

**Interfaces:**
- Produces: `schema.constellationStars` with columns `id, coupleId, constellationKey, promptKey, kind, title, status, answers, photoUrl, posX, posY, createdBy, litAt, createdAt, updatedAt`.

- [ ] **Step 1: Add the table** to `src/database/schema/index.ts` (after the existing `watchParties`/entertainment tables; `couples` and `users` are already defined above). Use `integer` for positions (already imported). `jsonb` and `uuid` are already imported.

```ts
// ─── Constellation of Us ─────────────────────────────────────────────────────
export const constellationStars = pgTable('constellation_stars', {
  id: uuid('id').primaryKey().defaultRandom(),
  coupleId: uuid('couple_id')
    .notNull()
    .references((): AnyPgColumn => couples.id),
  // 'firsts' | 'inside_jokes' | 'little_things' | 'what_i_admire' | 'dreams'
  //   | 'hard_times' | 'just_us' | 'custom'
  constellationKey: varchar('constellation_key', { length: 40 }).notNull(),
  // null for custom stars; otherwise the curated prompt id
  promptKey: varchar('prompt_key', { length: 80 }),
  // 'shared' | 'guess' | 'custom'
  kind: varchar('kind', { length: 16 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  // 'pending' | 'lit'
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  // shapes vary by kind — see the service. Defaults to {}.
  answers: jsonb('answers').notNull().default({}),
  photoUrl: varchar('photo_url', { length: 512 }),
  // 0..1000 normalized grid, assigned on creation (seeded jitter per constellation)
  posX: integer('pos_x').notNull().default(500),
  posY: integer('pos_y').notNull().default(500),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  litAt: timestamp('lit_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @linkup/api db:generate`
Expected: a new file `apps/api/src/database/migrations/0006_*.sql` containing `CREATE TABLE "constellation_stars"`.

- [ ] **Step 3: Verify the SQL** — open the generated `0006_*.sql` and confirm it creates `constellation_stars` with the FKs to `couples(id)` and `users(id)`. No manual edits expected.

- [ ] **Step 4: Apply locally**

Run: `pnpm --filter @linkup/api db:migrate`
Expected: migration applies with no error (local DB on port 5433).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/database/schema/index.ts apps/api/src/database/migrations/
git -c user.name="ByapakSigdel" commit -m "feat(constellation): constellation_stars table + migration"
git push origin main
```

---

## Task 2: Constellation service + status logic (TDD)

**Files:**
- Create: `apps/api/src/modules/constellation/constellation.service.ts`
- Test: `apps/api/src/modules/constellation/constellation.service.spec.ts`

**Interfaces:**
- Produces:
  - `applyContribution(star, kind, userId, contribution): { answers, status, litAt }` — pure function computing the new `answers`/`status` from a contribution. Exported for testing.
  - `class ConstellationService` with `getStars(coupleId)`, `upsertStar(userId, coupleId, dto)`, `updateStar(userId, coupleId, id, patch)`.
  - DTO type `UpsertStarDto = { constellationKey, promptKey?, kind: 'shared'|'guess'|'custom', title, contribution: Contribution }`.
  - `Contribution` union:
    - shared/custom: `{ text: string }`
    - guess (as subject): `{ role: 'subject', text: string }`
    - guess (as guesser): `{ role: 'guesser', text: string }`

The pure `applyContribution` encodes the lighting rules:
- **custom**: lights immediately on the creator's text → `answers = { [userId]: { text } }`, `status='lit'`.
- **shared**: `answers = { [userId]: { text }, ... }`; `status='lit'` once **both** partner ids have a text.
- **guess**: `answers = { subjectId, answer:{text}, guess:{by,text}, matched:null }`; `status='lit'` once both `answer` and `guess` exist.

- [ ] **Step 1: Write failing tests** in `constellation.service.spec.ts`:

```ts
import { applyContribution } from './constellation.service';

describe('applyContribution', () => {
  const A = 'user-a';
  const B = 'user-b';

  it('lights a custom star immediately', () => {
    const r = applyContribution({}, 'custom', A, { text: 'our song' });
    expect(r.status).toBe('lit');
    expect(r.answers).toEqual({ [A]: { text: 'our song' } });
    expect(r.litAt).toBeInstanceOf(Date);
  });

  it('shared star stays pending with one side, lights with both', () => {
    const one = applyContribution({}, 'shared', A, { text: 'a' });
    expect(one.status).toBe('pending');
    expect(one.litAt).toBeNull();
    const both = applyContribution(one.answers, 'shared', B, { text: 'b' });
    expect(both.status).toBe('lit');
    expect(both.answers).toEqual({ [A]: { text: 'a' }, [B]: { text: 'b' } });
  });

  it('guess star: subject then guesser lights it', () => {
    const subj = applyContribution({}, 'guess', A, { role: 'subject', text: 'tea' });
    expect(subj.status).toBe('pending');
    expect(subj.answers).toMatchObject({ subjectId: A, answer: { text: 'tea' } });
    const guess = applyContribution(subj.answers, 'guess', B, { role: 'guesser', text: 'coffee' });
    expect(guess.status).toBe('lit');
    expect(guess.answers).toMatchObject({
      subjectId: A,
      answer: { text: 'tea' },
      guess: { by: B, text: 'coffee' },
      matched: null,
    });
  });

  it('guess star: guesser first then subject still lights', () => {
    const guess = applyContribution({}, 'guess', B, { role: 'guesser', text: 'coffee' });
    expect(guess.status).toBe('pending');
    const subj = applyContribution(guess.answers, 'guess', A, { role: 'subject', text: 'tea' });
    expect(subj.status).toBe('lit');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter @linkup/api exec jest src/modules/constellation/constellation.service.spec.ts`
Expected: FAIL — `applyContribution` not found.
(If jest is not configured for the api, run via `pnpm --filter @linkup/api exec ts-node` against a tiny script that imports and asserts; but first check `apps/api/package.json` for a `test` script and use it. Use whatever the repo already uses for unit tests.)

- [ ] **Step 3: Implement** `constellation.service.ts`:

```ts
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

export type StarKind = 'shared' | 'guess' | 'custom';
export type Contribution =
  | { text: string }
  | { role: 'subject' | 'guesser'; text: string };

export interface UpsertStarDto {
  constellationKey: string;
  promptKey?: string;
  kind: StarKind;
  title: string;
  contribution: Contribution;
}

type Answers = Record<string, unknown>;

/** Pure rule for merging a contribution + computing lit status. */
export function applyContribution(
  prev: Answers,
  kind: StarKind,
  userId: string,
  contribution: Contribution,
): { answers: Answers; status: 'pending' | 'lit'; litAt: Date | null } {
  const answers: Answers = { ...prev };
  let lit = false;

  if (kind === 'custom') {
    answers[userId] = { text: (contribution as { text: string }).text };
    lit = true;
  } else if (kind === 'shared') {
    answers[userId] = { text: (contribution as { text: string }).text };
    const ids = Object.keys(answers);
    lit = ids.length >= 2;
  } else {
    // guess
    const c = contribution as { role: 'subject' | 'guesser'; text: string };
    if (c.role === 'subject') {
      answers.subjectId = userId;
      answers.answer = { text: c.text };
    } else {
      answers.guess = { by: userId, text: c.text };
      if (answers.matched === undefined) answers.matched = null;
    }
    lit = Boolean(answers.answer) && Boolean(answers.guess);
  }

  return { answers, status: lit ? 'lit' : 'pending', litAt: lit ? new Date() : null };
}

/** Deterministic-ish placement within a constellation's region (0..1000 grid). */
export function placeStar(constellationKey: string, seed: string): { posX: number; posY: number } {
  const REGIONS: Record<string, { x: number; y: number }> = {
    firsts: { x: 250, y: 200 }, inside_jokes: { x: 700, y: 250 },
    little_things: { x: 200, y: 600 }, what_i_admire: { x: 500, y: 450 },
    dreams: { x: 780, y: 620 }, hard_times: { x: 450, y: 800 },
    just_us: { x: 850, y: 850 }, custom: { x: 500, y: 500 },
  };
  const base = REGIONS[constellationKey] ?? REGIONS.custom;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const jitterX = ((h % 200) - 100);
  const jitterY = (((h >> 8) % 200) - 100);
  return {
    posX: Math.max(20, Math.min(980, base.x + jitterX)),
    posY: Math.max(20, Math.min(980, base.y + jitterY)),
  };
}

@Injectable()
export class ConstellationService {
  constructor(@Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  private async coupleIdFor(userId: string): Promise<string> {
    const [u] = await this.db
      .select({ coupleId: schema.users.coupleId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!u?.coupleId) throw new ForbiddenException('Not paired');
    return u.coupleId;
  }

  async getStars(userId: string) {
    const coupleId = await this.coupleIdFor(userId);
    return this.db
      .select()
      .from(schema.constellationStars)
      .where(eq(schema.constellationStars.coupleId, coupleId));
  }

  /** Returns { star, coupleId } so the controller can relay to the partner. */
  async upsertStar(userId: string, dto: UpsertStarDto) {
    const coupleId = await this.coupleIdFor(userId);

    // Curated prompts upsert by (coupleId, promptKey); custom always inserts.
    let existing: typeof schema.constellationStars.$inferSelect | undefined;
    if (dto.promptKey) {
      [existing] = await this.db
        .select()
        .from(schema.constellationStars)
        .where(
          and(
            eq(schema.constellationStars.coupleId, coupleId),
            eq(schema.constellationStars.promptKey, dto.promptKey),
          ),
        )
        .limit(1);
    }

    const prevAnswers = (existing?.answers as Answers) ?? {};
    const merged = applyContribution(prevAnswers, dto.kind, userId, dto.contribution);

    if (existing) {
      const [updated] = await this.db
        .update(schema.constellationStars)
        .set({
          answers: merged.answers,
          status: merged.status,
          litAt: existing.litAt ?? merged.litAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.constellationStars.id, existing.id))
        .returning();
      return { star: updated, coupleId };
    }

    const pos = placeStar(dto.constellationKey, dto.promptKey ?? `${userId}-${Date.now()}`);
    const [created] = await this.db
      .insert(schema.constellationStars)
      .values({
        coupleId,
        constellationKey: dto.constellationKey,
        promptKey: dto.promptKey ?? null,
        kind: dto.kind,
        title: dto.title,
        status: merged.status,
        answers: merged.answers,
        posX: pos.posX,
        posY: pos.posY,
        createdBy: userId,
        litAt: merged.litAt,
      })
      .returning();
    return { star: created, coupleId };
  }

  async updateStar(
    userId: string,
    id: string,
    patch: { photoUrl?: string; matched?: boolean; text?: string },
  ) {
    const coupleId = await this.coupleIdFor(userId);
    const [star] = await this.db
      .select()
      .from(schema.constellationStars)
      .where(eq(schema.constellationStars.id, id))
      .limit(1);
    if (!star || star.coupleId !== coupleId) throw new NotFoundException('Star not found');

    const answers = { ...(star.answers as Answers) };
    if (patch.matched !== undefined && answers.guess) answers.matched = patch.matched;
    if (patch.text !== undefined) {
      if (star.kind === 'guess') {
        // editing your own side
        if ((answers as any).subjectId === userId) (answers as any).answer = { text: patch.text };
        else (answers as any).guess = { by: userId, text: patch.text };
      } else {
        answers[userId] = { text: patch.text };
      }
    }

    const [updated] = await this.db
      .update(schema.constellationStars)
      .set({
        answers,
        photoUrl: patch.photoUrl ?? star.photoUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.constellationStars.id, id))
      .returning();
    return { star: updated, coupleId };
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm --filter @linkup/api exec jest src/modules/constellation/constellation.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/constellation/constellation.service.ts apps/api/src/modules/constellation/constellation.service.spec.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): service + star lighting rules (tested)"
git push origin main
```

---

## Task 3: Controller, module, realtime relay + push nudge

**Files:**
- Create: `apps/api/src/modules/constellation/constellation.controller.ts`
- Create: `apps/api/src/modules/constellation/constellation.module.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `ConstellationService` (Task 2), `EventsGateway.emitToUser(userId, event, data)` (public, exported by `GatewayModule`), `FcmService` (global `PushModule`), `JwtAuthGuard`, `@CurrentUser('id')`.
- Produces: routes `GET /constellation`, `POST /constellation/stars`, `PATCH /constellation/stars/:id`; relayed socket event `constellation:star`.

- [ ] **Step 1: Controller** `constellation.controller.ts`:

```ts
import {
  Controller, Get, Post, Patch, Body, Param, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConstellationService, UpsertStarDto } from './constellation.service';
import { EventsGateway } from '../../gateway/events.gateway';
import { FcmService } from '../push/fcm.service';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';

@Controller('constellation')
@UseGuards(JwtAuthGuard)
export class ConstellationController {
  constructor(
    private readonly service: ConstellationService,
    private readonly gateway: EventsGateway,
    private readonly fcm: FcmService,
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  @Get()
  async list(@CurrentUser('id') userId: string) {
    const stars = await this.service.getStars(userId);
    return { success: true, data: { stars } };
  }

  @Post('stars')
  async upsert(@CurrentUser('id') userId: string, @Body() dto: UpsertStarDto) {
    const { star, coupleId } = await this.service.upsertStar(userId, dto);
    await this.relay(userId, coupleId, star);
    return { success: true, data: { star } };
  }

  @Patch('stars/:id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() patch: { photoUrl?: string; matched?: boolean; text?: string },
  ) {
    const { star, coupleId } = await this.service.updateStar(userId, id, patch);
    await this.relay(userId, coupleId, star);
    return { success: true, data: { star } };
  }

  /** Notify the partner in real time + a push nudge when a star is touched. */
  private async relay(userId: string, coupleId: string, star: unknown) {
    const [couple] = await this.db
      .select({ p1: schema.couples.partner1Id, p2: schema.couples.partner2Id })
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);
    if (!couple) return;
    const partnerId = couple.p1 === userId ? couple.p2 : couple.p1;
    if (!partnerId) return;

    this.gateway.emitToUser(partnerId, 'constellation:star', star);

    // Push nudge (best-effort; only meaningful when the star just lit or was added).
    try {
      const [me] = await this.db
        .select({ name: schema.users.displayName })
        .from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      const [partner] = await this.db
        .select({ token: schema.users.fcmToken })
        .from(schema.users).where(eq(schema.users.id, partnerId)).limit(1);
      if (partner?.token) {
        await this.fcm.sendToToken(
          partner.token,
          `${me?.name || 'Your partner'} added a star ✨`,
          'Open your Constellation of Us',
          { type: 'constellation' },
        );
      }
    } catch { /* best-effort */ }
  }
}
```

- [ ] **Step 2: Module** `constellation.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConstellationController } from './constellation.controller';
import { ConstellationService } from './constellation.service';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
  imports: [GatewayModule], // for EventsGateway; PushModule is global, DatabaseModule global
  controllers: [ConstellationController],
  providers: [ConstellationService],
})
export class ConstellationModule {}
```

- [ ] **Step 3: Register** in `src/app.module.ts` — add `import { ConstellationModule } from './modules/constellation/constellation.module';` and add `ConstellationModule,` to the `imports` array (next to `EntertainmentModule`).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @linkup/api exec tsc --noEmit`
Expected: no NEW errors in `modules/constellation/*` (pre-existing unrelated strict errors are fine).

- [ ] **Step 5: Smoke test the route** — start the api (`pnpm --filter @linkup/api dev`), then with a valid token:

Run:
```bash
curl -s -X POST localhost:4000/api/v1/constellation/stars -H "Authorization: Bearer $TOK" \
  -H 'Content-Type: application/json' \
  -d '{"constellationKey":"custom","kind":"custom","title":"our song","contribution":{"text":"Yellow"}}'
```
Expected: `{"success":true,"data":{"star":{...,"status":"lit"}}}`, and `GET /constellation` returns it.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/constellation/ apps/api/src/app.module.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): REST endpoints + realtime relay + push nudge"
git push origin main
```

---

## Task 4: The prompt deck (shared content, duplicated)

**Files:**
- Create: `mobile/src/components/games/constellation/deck.ts`
- Create: `apps/web/src/components/games/constellation/deck.ts` (identical)
- Create: `mobile/src/components/games/constellation/types.ts` and `apps/web/.../types.ts` (identical)

**Interfaces:**
- Produces:
  - `types.ts`: `StarKind = 'shared'|'guess'|'custom'`; `Star` (matches the API row); `Constellation = { key; name; blurb }`; `Prompt = { key; constellationKey; kind: 'shared'|'guess'; title; tier: 'warm'|'deep'|'spicy' }`.
  - `deck.ts`: `CONSTELLATIONS: Constellation[]` (the 7 themes) and `PROMPTS: Prompt[]` (~48), plus `promptsFor(key)` and `dailyPrompt(coupleId, dateISO, litPromptKeys)` (deterministic un-lit pick).

- [ ] **Step 1: Write `types.ts`** (both clients, identical):

```ts
export type StarKind = 'shared' | 'guess' | 'custom';
export interface Star {
  id: string;
  coupleId: string;
  constellationKey: string;
  promptKey: string | null;
  kind: StarKind;
  title: string;
  status: 'pending' | 'lit';
  answers: Record<string, any>;
  photoUrl: string | null;
  posX: number;
  posY: number;
  createdBy: string;
  litAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface Constellation { key: string; name: string; blurb: string; }
export interface Prompt {
  key: string; constellationKey: string; kind: 'shared' | 'guess';
  title: string; tier: 'warm' | 'deep' | 'spicy';
}
```

- [ ] **Step 2: Write `deck.ts`** (both clients, identical) — full curated content:

```ts
import type { Constellation, Prompt } from './types';

export const CONSTELLATIONS: Constellation[] = [
  { key: 'firsts', name: 'Firsts', blurb: 'Where it all began.' },
  { key: 'inside_jokes', name: 'Inside Jokes', blurb: "Things only you two get." },
  { key: 'little_things', name: 'Little Things', blurb: 'The small stuff that is everything.' },
  { key: 'what_i_admire', name: 'What I Admire', blurb: 'What I see in you.' },
  { key: 'dreams', name: 'Dreams', blurb: 'Where we are headed.' },
  { key: 'hard_times', name: 'Hard Times We Survived', blurb: 'Storms we weathered.' },
  { key: 'just_us', name: 'Just Us', blurb: 'For your eyes only.' },
];

export const PROMPTS: Prompt[] = [
  // Firsts
  { key: 'firsts_met', constellationKey: 'firsts', kind: 'shared', tier: 'warm', title: 'Where did we first meet — and what do you remember?' },
  { key: 'firsts_impression', constellationKey: 'firsts', kind: 'guess', tier: 'warm', title: 'What was my very first impression of you?' },
  { key: 'firsts_date', constellationKey: 'firsts', kind: 'shared', tier: 'warm', title: 'Our first date — describe it in your words.' },
  { key: 'firsts_iloveyou', constellationKey: 'firsts', kind: 'shared', tier: 'deep', title: 'The first “I love you” — who, when, where?' },
  { key: 'firsts_trip', constellationKey: 'firsts', kind: 'shared', tier: 'warm', title: 'Our first trip together.' },
  { key: 'firsts_song', constellationKey: 'firsts', kind: 'guess', tier: 'warm', title: 'What would you say is “our song”?' },
  // Inside Jokes
  { key: 'jokes_phrase', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'A phrase only we understand — and its origin.' },
  { key: 'jokes_nickname', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'The story behind a nickname.' },
  { key: 'jokes_funniest', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'The funniest thing that ever happened to us.' },
  { key: 'jokes_cant_explain', constellationKey: 'inside_jokes', kind: 'shared', tier: 'warm', title: 'Something we find hilarious that no one else does.' },
  { key: 'jokes_meme', constellationKey: 'inside_jokes', kind: 'guess', tier: 'warm', title: 'What meme/gif is SO us?' },
  // Little Things
  { key: 'little_coffee', constellationKey: 'little_things', kind: 'guess', tier: 'warm', title: 'Exactly how do I take my coffee/tea?' },
  { key: 'little_comfort', constellationKey: 'little_things', kind: 'guess', tier: 'warm', title: 'My ultimate comfort food?' },
  { key: 'little_lovelang', constellationKey: 'little_things', kind: 'guess', tier: 'deep', title: 'What is my love language?' },
  { key: 'little_badday', constellationKey: 'little_things', kind: 'guess', tier: 'deep', title: 'What cheers me up on a bad day?' },
  { key: 'little_habit', constellationKey: 'little_things', kind: 'shared', tier: 'warm', title: 'A small habit of yours I secretly adore.' },
  { key: 'little_sound', constellationKey: 'little_things', kind: 'guess', tier: 'warm', title: 'A sound or smell that reminds me of you?' },
  // What I Admire
  { key: 'admire_better', constellationKey: 'what_i_admire', kind: 'shared', tier: 'warm', title: 'Something you are better at than me.' },
  { key: 'admire_proud', constellationKey: 'what_i_admire', kind: 'shared', tier: 'deep', title: 'A moment I was really proud of you.' },
  { key: 'admire_quality', constellationKey: 'what_i_admire', kind: 'shared', tier: 'deep', title: 'A quality of yours I want to grow in myself.' },
  { key: 'admire_strength', constellationKey: 'what_i_admire', kind: 'guess', tier: 'deep', title: 'What do you think I most admire about you?' },
  { key: 'admire_changed', constellationKey: 'what_i_admire', kind: 'shared', tier: 'deep', title: 'How you have changed me for the better.' },
  // Dreams
  { key: 'dreams_place', constellationKey: 'dreams', kind: 'shared', tier: 'warm', title: 'A place we MUST go together.' },
  { key: 'dreams_fiveyears', constellationKey: 'dreams', kind: 'shared', tier: 'deep', title: 'Where do you hope we are in 5 years?' },
  { key: 'dreams_build', constellationKey: 'dreams', kind: 'shared', tier: 'deep', title: 'Something we should build or do together.' },
  { key: 'dreams_tradition', constellationKey: 'dreams', kind: 'shared', tier: 'warm', title: 'A tradition you want us to start.' },
  { key: 'dreams_perfectday', constellationKey: 'dreams', kind: 'guess', tier: 'warm', title: 'Describe my perfect lazy day.' },
  // Hard Times We Survived
  { key: 'hard_fight', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'A disagreement that ended up making us stronger.' },
  { key: 'hard_showedup', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'A time you showed up for me when it mattered.' },
  { key: 'hard_scared', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'Something hard we got through together.' },
  { key: 'hard_grateful', constellationKey: 'hard_times', kind: 'shared', tier: 'deep', title: 'Something about you I am grateful for but rarely say.' },
  // Just Us (spicy)
  { key: 'just_attracted', constellationKey: 'just_us', kind: 'guess', tier: 'spicy', title: 'What first physically drew me to you?' },
  { key: 'just_favmoment', constellationKey: 'just_us', kind: 'shared', tier: 'spicy', title: 'A favourite intimate memory of us.' },
  { key: 'just_turnson', constellationKey: 'just_us', kind: 'guess', tier: 'spicy', title: 'Guess one thing that makes me weak for you.' },
  { key: 'just_fantasy', constellationKey: 'just_us', kind: 'shared', tier: 'spicy', title: 'A little fantasy or wish for us.' },
];

export function promptsFor(constellationKey: string): Prompt[] {
  return PROMPTS.filter((p) => p.constellationKey === constellationKey);
}

/** Deterministic daily prompt: stable per (coupleId, date), skips already-lit prompts. */
export function dailyPrompt(coupleId: string, dateISO: string, litKeys: string[]): Prompt | null {
  const pool = PROMPTS.filter((p) => !litKeys.includes(p.key));
  if (pool.length === 0) return null;
  const seed = `${coupleId}:${dateISO}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
```

- [ ] **Step 3: Copy** the two files verbatim into `apps/web/src/components/games/constellation/`.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/games/constellation/deck.ts mobile/src/components/games/constellation/types.ts apps/web/src/components/games/constellation/deck.ts apps/web/src/components/games/constellation/types.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): curated prompt deck + types (web+mobile)"
git push origin main
```

---

## Task 5: Mobile constellation store

**Files:**
- Create: `mobile/src/stores/constellation-store.ts`

**Interfaces:**
- Consumes: `api` (`@/lib/api`), `Star` type, `UpsertStarDto` shape (Task 2).
- Produces: `useConstellationStore` with `stars: Star[]`, `loading`, `fetchStars()`, `answer(dto)`, `patchStar(id, patch)`, `applyRemote(star)`, `litPromptKeys(): string[]`, `reset()`.

- [ ] **Step 1: Implement**:

```ts
import { create } from 'zustand';
import api from '@/lib/api';
import type { Star } from '@/components/games/constellation/types';

interface ConstellationState {
  stars: Star[];
  loading: boolean;
  fetchStars: () => Promise<void>;
  answer: (dto: {
    constellationKey: string; promptKey?: string;
    kind: 'shared' | 'guess' | 'custom'; title: string; contribution: unknown;
  }) => Promise<void>;
  patchStar: (id: string, patch: { photoUrl?: string; matched?: boolean; text?: string }) => Promise<void>;
  applyRemote: (star: Star) => void;
  litPromptKeys: () => string[];
  reset: () => void;
}

function upsertById(list: Star[], star: Star): Star[] {
  const i = list.findIndex((s) => s.id === star.id);
  if (i === -1) return [...list, star];
  const copy = list.slice();
  copy[i] = star;
  return copy;
}

export const useConstellationStore = create<ConstellationState>()((set, get) => ({
  stars: [],
  loading: false,
  fetchStars: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get('/constellation');
      set({ stars: data.data.stars ?? [] });
    } catch {
      /* keep prior */
    } finally {
      set({ loading: false });
    }
  },
  answer: async (dto) => {
    const { data } = await api.post('/constellation/stars', dto);
    set({ stars: upsertById(get().stars, data.data.star) });
  },
  patchStar: async (id, patch) => {
    const { data } = await api.patch(`/constellation/stars/${id}`, patch);
    set({ stars: upsertById(get().stars, data.data.star) });
  },
  applyRemote: (star) => set({ stars: upsertById(get().stars, star) }),
  litPromptKeys: () =>
    get().stars.filter((s) => s.status === 'lit' && s.promptKey).map((s) => s.promptKey as string),
  reset: () => set({ stars: [], loading: false }),
}));
```

- [ ] **Step 2: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/stores/constellation-store.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): mobile store"
git push origin main
```

---

## Task 6: Mobile SkyView (SVG starfield)

**Files:**
- Create: `mobile/src/components/games/constellation/sky-view.tsx`

**Interfaces:**
- Consumes: `Star` type, `CONSTELLATIONS`, `promptsFor` (deck), `useTheme()`, user `reduceMotion` (read `useThemeStore`/settings as other screens do).
- Produces: `<SkyView stars={Star[]} onPressStar={(star)=>void} onPressEmpty={()=>void} />` — a pannable SVG starfield mapping the 0..1000 grid into a zoomable canvas. Lit stars are bright; pending (deck prompts not yet a star) render dim at their seeded position; completed constellations draw connecting lines + a label.

- [ ] **Step 1: Implement** the component. Use `react-native-svg` (`Svg, Circle, Line, Text as SvgText, G`) inside a `react-native-gesture-handler` `GestureDetector` (pan) + reanimated shared values for the translate; clamp zoom to a fixed scale for v1 (pinch can be added later). Render order: constellation lines (for complete groups) → pending dim stars → lit stars → labels. A lit star = `<Circle r=6 fill={colors.primary}>` with a soft halo; pending = `<Circle r=3 fill={colors.textMuted} opacity=0.35>`. Map grid (0..1000) → canvas via a `SKY = 1000` constant scaled to the viewport width\*1.4 (so there's room to pan). Twinkle: a reanimated opacity loop on lit stars, **disabled when reduceMotion**. Compute pending positions with the same `placeStar` seed logic as the server (duplicate the `placeStar` pure fn into `deck.ts` so client + server agree; if you prefer, the client may instead only render pending markers per-constellation cluster without exact server match — acceptable for v1). Completed-constellation detection: a constellation is complete when every non-`spicy` prompt in it has a lit star; when complete, draw `<Line>`s connecting its lit stars in prompt order + an `<SvgText>` label.

This is the visual centerpiece; build it functional here, then refine in the Task 11 polish pass. Keep all colors from `useTheme()`.

- [ ] **Step 2: Render smoke check** — temporarily mount `<SkyView stars={[]} .../>` in the screen (Task 9) and confirm it renders an empty sky with dim pending markers and pans without crashing on a device/emulator.

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/games/constellation/sky-view.tsx mobile/src/components/games/constellation/deck.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): mobile SVG sky-view (pan + stars + lines)"
git push origin main
```

---

## Task 7: Mobile prompt flow + star detail

**Files:**
- Create: `mobile/src/components/games/constellation/prompt-sheet.tsx`
- Create: `mobile/src/components/games/constellation/star-detail.tsx`

**Interfaces:**
- `prompt-sheet.tsx` → `<PromptSheet visible onClose dailyPrompt deck onAnswer={(prompt, contribution)=>void} onCustom={(title,text)=>void} />` — shows the daily highlighted prompt + a deck list grouped by constellation (tier-gate `spicy` behind a tap-to-reveal), and the per-kind answer input (shared/custom = one text box; guess = pick "answer about me" or "guess about you" → text box). Calls back; the screen calls `store.answer(...)`.
- `star-detail.tsx` → `<StarDetail star onClose onEditText onAddPhoto onJudge={(matched:boolean)=>void} />` — reveals both answers; for `guess` stars with both sides present, shows "Nailed it ✓ / So close" (calls `store.patchStar(id,{matched})`); photo via `useMediaStore().uploadFile(couple.id, file)` then `patchStar(id,{photoUrl})`.

- [ ] **Step 1: Implement `prompt-sheet.tsx`** — a `Modal`/bottom sheet using existing `ui.tsx` primitives (`Card`, `Input`, `Button`, `AppText`). Build the contribution object exactly per kind:
  - shared/custom: `{ text }`
  - guess as subject: `{ role: 'subject', text }`
  - guess as guesser: `{ role: 'guesser', text }`

- [ ] **Step 2: Implement `star-detail.tsx`** — read both sides from `star.answers`; reuse the photo upload pattern from the profile avatar change (`ImagePicker` → `useMediaStore().uploadFile`). Respect the unpaired/edge states.

- [ ] **Step 3: Typecheck** `cd mobile && npx tsc --noEmit` → 0 errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/games/constellation/prompt-sheet.tsx mobile/src/components/games/constellation/star-detail.tsx
git -c user.name="ByapakSigdel" commit -m "feat(constellation): mobile prompt flow + star detail"
git push origin main
```

---

## Task 8: Mobile screen + registry + realtime subscription

**Files:**
- Create: `mobile/src/components/games/constellation/index.tsx`
- Modify: `mobile/src/components/games/registry.ts`

**Interfaces:**
- Consumes: store (Task 5), SkyView (Task 6), PromptSheet + StarDetail (Task 7), `getSocket()` (`@/lib/socket`), `useAuthStore` (couple), `dailyPrompt` (deck).
- Produces: `export function ConstellationOfUs()` (a `ComponentType`, no props — matches registry contract) and a `GAMES` entry `{ key:'constellation-of-us', name:'Constellation of Us', tagline:'Your star-chart, together', emoji:'✦', category:'couple', Component: ConstellationOfUs }`.

- [ ] **Step 1: Implement `index.tsx`** — on mount `fetchStars()`, subscribe `getSocket()?.on('constellation:star', applyRemote)` (off on unmount), render `<SkyView>` + a progress header + the `+ Light a new star` button opening `<PromptSheet>`, and `<StarDetail>` when a star is tapped. Compute the daily prompt via `dailyPrompt(couple.id, new Date().toISOString().slice(0,10), store.litPromptKeys())`. Show the unpaired empty state if `!couple?.isPaired`.

- [ ] **Step 2: Register** — in `registry.ts` add the import and the `GAMES` entry as the FIRST item in the `couple` category.

- [ ] **Step 3: Run it** — open `/games/constellation-of-us` on two accounts; answer a `guess` prompt on each side; confirm the star lights, the partner sees it (socket), the push nudge fires, and self-judge works. Verify on the default + one other theme.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/games/constellation/index.tsx mobile/src/components/games/registry.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): mobile screen + registry + realtime"
git push origin main
```

---

## Task 9: Web parity

**Files:**
- Create: `apps/web/src/stores/constellation-store.ts`
- Create: `apps/web/src/components/games/constellation/{sky-view,prompt-sheet,star-detail,index}.tsx`
- Modify: `apps/web/src/components/games/registry.ts`

**Interfaces:** mirror Tasks 5–8 using web equivalents — `apps/web/src/lib/api`, the web theme context, web SVG (plain `<svg>` + CSS/`framer-motion` if already used), the web media upload store, and the web socket accessor. Same store API, same component props, same registry entry.

- [ ] **Step 1: Port the store** (identical logic to Task 5, web `api` import).
- [ ] **Step 2: Port SkyView** as an SVG `<svg viewBox="0 0 1000 1000">` with pan via pointer drag; same star/line rules.
- [ ] **Step 3: Port prompt-sheet + star-detail** using web UI primitives + the web media upload.
- [ ] **Step 4: Port the screen** (`use-game-session` not needed; subscribe to `constellation:star` via the web socket) + register in the web `registry.ts`.
- [ ] **Step 5: Typecheck** `pnpm --filter @linkup/web exec tsc --noEmit` → no new errors.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src/stores/constellation-store.ts apps/web/src/components/games/constellation/ apps/web/src/components/games/registry.ts
git -c user.name="ByapakSigdel" commit -m "feat(constellation): web parity"
git push origin main
```

---

## Task 10: Polish pass (frontend-design)

**Files:** the four `sky-view.tsx`/screen files on both platforms (+ small theme touches).

- [ ] **Step 1: Invoke `frontend-design`** for the starfield aesthetic: per-theme star palette (constellation/daybreak/retro/etc.), the shooting-star arrival animation, constellation line-draw reveal + name flourish, the empty-state "map to discover", and the "you know each other X%" progress treatment. Keep within theme tokens; respect reduce-motion.
- [ ] **Step 2: Cross-theme check** — verify the sky on all 6 themes (no hardcoded colors, legible labels, sensible contrast).
- [ ] **Step 3: Commit**

```bash
git -c user.name="ByapakSigdel" commit -am "polish(constellation): per-theme starfield + animations"
git push origin main
```

---

## Task 11: Deploy + release

- [ ] **Step 1: Apply the migration in prod** — on the VM: `pnpm --filter @linkup/api db:migrate` (or via the deploy step), confirm `constellation_stars` exists.
- [ ] **Step 2: Deploy api + web** — rebuild + recreate the `api` and `web` containers (existing deploy command).
- [ ] **Step 3: Build + publish the mobile APK** — bump `mobile/src/lib/env.ts` `APP_BUILD`, `assembleRelease`, upload under a fresh `LinkUp-N.apk` filename, bump `latest.json`.
- [ ] **Step 4: Verify end-to-end in prod** with the two test accounts (star lights across devices, push nudge, photo, themes).

---

## Self-review notes
- **Spec coverage:** sky/3 star kinds/async/daily+deck pacing → Tasks 4,6,7,8; data model → Task 1; endpoints + relay + push → Tasks 2,3; SVG render + self-judge → Tasks 6,7; web parity → Task 9; polish → Task 10; persistence/migration → Tasks 1,11. All spec sections map to a task.
- **Type consistency:** `applyContribution`, `UpsertStarDto`, `Star`, `Contribution`, `placeStar`, store method names are used identically across tasks.
- **Known pragmatic call:** the heaviest UI (SkyView) is specified by contract + rules rather than full pixel code; exact visuals are intentionally finished in the Task 10 frontend-design pass — flagged, not a hidden placeholder.
