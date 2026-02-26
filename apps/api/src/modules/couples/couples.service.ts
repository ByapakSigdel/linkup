import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
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

    return updated;
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
