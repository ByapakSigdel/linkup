import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class CouplesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createCouple(userId: string) {
    // Check if user already has a couple
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.coupleId) {
      throw new ConflictException('User is already part of a couple');
    }

    // Generate pairing code
    const pairingCode = this.generatePairingCode();
    const pairingCodeExpiresAt = new Date();
    pairingCodeExpiresAt.setHours(pairingCodeExpiresAt.getHours() + 24);

    // Create couple
    const [couple] = await this.db
      .insert(schema.couples)
      .values({
        partner1Id: userId,
        pairingCode,
        pairingCodeExpiresAt,
      })
      .returning();

    if (!couple) {
      throw new Error('Failed to create couple');
    }

    // Update user's coupleId
    await this.db
      .update(schema.users)
      .set({ coupleId: couple.id, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    return couple;
  }

  async joinCouple(userId: string, pairingCode: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.coupleId) {
      throw new ConflictException('User is already part of a couple');
    }

    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.pairingCode, pairingCode))
      .limit(1);

    if (!couple) {
      throw new NotFoundException('Invalid pairing code');
    }

    if (couple.isPaired) {
      throw new ConflictException('This couple is already paired');
    }

    if (couple.pairingCodeExpiresAt && couple.pairingCodeExpiresAt < new Date()) {
      throw new BadRequestException('Pairing code has expired');
    }

    if (couple.partner1Id === userId) {
      throw new BadRequestException('Cannot pair with yourself');
    }

    // Update couple
    const [updated] = await this.db
      .update(schema.couples)
      .set({
        partner2Id: userId,
        isPaired: true,
        pairingCode: null,
        pairingCodeExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.couples.id, couple.id))
      .returning();

    // Update user's coupleId
    await this.db
      .update(schema.users)
      .set({ coupleId: couple.id, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    return updated;
  }

  async getCoupleById(coupleId: string) {
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    return couple;
  }

  async updateCouple(
    coupleId: string,
    userId: string,
    data: {
      coupleName?: string;
      coupleAvatarUrl?: string;
      anniversaryDate?: string;
      relationshipStatus?: string;
      sharedThemeId?: string;
    },
  ) {
    // Verify user belongs to this couple
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    if (couple.partner1Id !== userId && couple.partner2Id !== userId) {
      throw new BadRequestException('User is not part of this couple');
    }

    const [updated] = await this.db
      .update(schema.couples)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.couples.id, coupleId))
      .returning();

    // The couple's Circle profile shares the couple's name (and avatar): keep
    // the circle in sync so renaming the couple renames their circle account.
    const circlePatch: Record<string, unknown> = {};
    if (data.coupleName && data.coupleName.trim()) {
      circlePatch.name = data.coupleName.trim();
    }
    if (data.coupleAvatarUrl !== undefined) {
      circlePatch.avatarUrl = data.coupleAvatarUrl || null;
    }
    if (Object.keys(circlePatch).length > 0) {
      circlePatch.updatedAt = new Date();
      await this.db
        .update(schema.circles)
        .set(circlePatch)
        .where(eq(schema.circles.createdByCoupleId, coupleId));
    }

    return updated;
  }

  /**
   * Record the surviving partner's "keep going on your own" decision on an ENDED
   * couple (the "Relationship Graveyard" memorial fork). After this:
   *  - the couple is marked `survivorDecision='archived_solo'` (+ decidedAt), and
   *  - the survivor unpairs (`coupleId → null`) but keeps a read-only archive
   *    pointer (`archivedCoupleId = couple.id`) so she can revisit the memorial.
   *
   * Shared rows are deliberately preserved (read-only forever); they are only
   * purged later if the survivor also deletes her account while the departing
   * partner is already tombstoned (see UsersService.deleteAccount).
   *
   * Guards (the caller must genuinely be the survivor of a still-pending ended
   * couple, never the partner who left):
   *  - caller must be in a couple (else 404),
   *  - that couple must be `relationshipStatus='ended'` with
   *    `survivorDecision='pending'` (else 409 — no pending memorial decision),
   *  - the caller must NOT be the partner who ended it (else 403).
   *
   * Both writes run in a single transaction so the couple can never be marked
   * decided without the survivor actually being unpaired (and vice versa). The
   * user is read directly via `db` (not UsersService) to avoid adding a cross-
   * module dependency / circular import.
   */
  async recordSurvivorDecision(
    userId: string,
    decision: 'archived_solo',
  ): Promise<void> {
    const [me] = await this.db
      .select({ id: schema.users.id, coupleId: schema.users.coupleId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!me?.coupleId) {
      throw new NotFoundException('No active relationship');
    }

    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, me.coupleId))
      .limit(1);

    if (
      !couple ||
      couple.relationshipStatus !== 'ended' ||
      couple.survivorDecision !== 'pending'
    ) {
      throw new ConflictException('No pending memorial decision');
    }

    // The partner who left can't make the survivor's choice for them.
    if (couple.endedByUserId === userId) {
      throw new ForbiddenException(
        'Only the surviving partner can make this decision',
      );
    }

    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.couples)
        .set({
          survivorDecision: decision,
          survivorDecidedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.couples.id, couple.id));
      await tx
        .update(schema.users)
        .set({ coupleId: null, archivedCoupleId: couple.id, updatedAt: now })
        .where(eq(schema.users.id, userId));
    });
  }

  private generatePairingCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
