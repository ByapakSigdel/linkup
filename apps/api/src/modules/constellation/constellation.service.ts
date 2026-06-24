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
  const base = REGIONS[constellationKey] ?? REGIONS['custom'] ?? { x: 500, y: 500 };
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

  async upsertStar(userId: string, dto: UpsertStarDto) {
    const coupleId = await this.coupleIdFor(userId);

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
        if ((answers as any).subjectId === userId) (answers as any).answer = { text: patch.text };
        else (answers as any).guess = { by: userId, text: patch.text };
      } else {
        answers[userId] = { text: patch.text };
      }
    }

    const [updated] = await this.db
      .update(schema.constellationStars)
      .set({ answers, photoUrl: patch.photoUrl ?? star.photoUrl, updatedAt: new Date() })
      .where(eq(schema.constellationStars.id, id))
      .returning();
    return { star: updated, coupleId };
  }
}
