import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConstellationService, UpsertStarDto } from './constellation.service';
import { EventsGateway } from '../../gateway/events.gateway';
import { FcmService } from '../push/fcm.service';
import { eq } from 'drizzle-orm';
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
