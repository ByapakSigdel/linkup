import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';

interface CreateWatchPartyInput {
  source?: string;
  videoId?: string;
  videoUrl?: string;
  title?: string;
}

interface UpdateWatchPartyInput {
  videoId?: string;
  videoUrl?: string;
  title?: string;
  status?: string;
}

interface CreateCallInput {
  type: 'voice' | 'video' | 'screen';
  status?: string;
}

interface UpdateCallInput {
  status: string;
  durationSec?: number;
}

@Injectable()
export class EntertainmentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
  ) {}

  private requireCouple(coupleId: string | null | undefined): string {
    if (!coupleId) {
      throw new BadRequestException('You must be in a couple');
    }
    return coupleId;
  }

  // ─── Watch Parties ──────────────────────────────────────────────────────────

  async createWatchParty(
    coupleId: string | null | undefined,
    userId: string,
    input: CreateWatchPartyInput,
  ) {
    const couple = this.requireCouple(coupleId);

    // End any existing active watch party for the couple.
    await this.db
      .update(schema.watchParties)
      .set({ status: 'ended', endedAt: new Date() })
      .where(
        and(
          eq(schema.watchParties.coupleId, couple),
          eq(schema.watchParties.status, 'active'),
        ),
      );

    const [party] = await this.db
      .insert(schema.watchParties)
      .values({
        coupleId: couple,
        hostId: userId,
        source: input.source ?? 'youtube',
        videoId: input.videoId ?? null,
        videoUrl: input.videoUrl ?? null,
        title: input.title ?? null,
        status: 'active',
      })
      .returning();

    if (!party) {
      throw new BadRequestException('Failed to create watch party');
    }

    // Notify partner of the invite.
    const partnerId = await this.gateway.resolvePartnerId(userId);
    if (partnerId) {
      this.gateway.emitToUser(partnerId, 'watch:invite', {
        party,
        from: userId,
      });
    }

    return { party };
  }

  async getActiveWatchParty(coupleId: string | null | undefined) {
    const couple = this.requireCouple(coupleId);

    const [party] = await this.db
      .select()
      .from(schema.watchParties)
      .where(
        and(
          eq(schema.watchParties.coupleId, couple),
          eq(schema.watchParties.status, 'active'),
        ),
      )
      .orderBy(desc(schema.watchParties.createdAt))
      .limit(1);

    return { party: party ?? null };
  }

  async updateWatchParty(
    id: string,
    coupleId: string | null | undefined,
    input: UpdateWatchPartyInput,
  ) {
    const couple = this.requireCouple(coupleId);

    const [existing] = await this.db
      .select()
      .from(schema.watchParties)
      .where(
        and(
          eq(schema.watchParties.id, id),
          eq(schema.watchParties.coupleId, couple),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Watch party not found');
    }

    const updates: Partial<typeof schema.watchParties.$inferInsert> = {};
    if (input.videoId !== undefined) updates.videoId = input.videoId;
    if (input.videoUrl !== undefined) updates.videoUrl = input.videoUrl;
    if (input.title !== undefined) updates.title = input.title;
    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'ended') {
        updates.endedAt = new Date();
      }
    }

    const [party] = await this.db
      .update(schema.watchParties)
      .set(updates)
      .where(eq(schema.watchParties.id, id))
      .returning();

    return { party };
  }

  async endWatchParty(id: string, coupleId: string | null | undefined) {
    const couple = this.requireCouple(coupleId);

    const [existing] = await this.db
      .select()
      .from(schema.watchParties)
      .where(
        and(
          eq(schema.watchParties.id, id),
          eq(schema.watchParties.coupleId, couple),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Watch party not found');
    }

    await this.db
      .update(schema.watchParties)
      .set({ status: 'ended', endedAt: new Date() })
      .where(eq(schema.watchParties.id, id));

    return { success: true };
  }

  async getWatchHistory(coupleId: string | null | undefined, limit = 20) {
    const couple = this.requireCouple(coupleId);
    const safeLimit = limit > 0 ? limit : 20;

    const parties = await this.db
      .select()
      .from(schema.watchParties)
      .where(
        and(
          eq(schema.watchParties.coupleId, couple),
          eq(schema.watchParties.status, 'ended'),
        ),
      )
      .orderBy(desc(schema.watchParties.createdAt))
      .limit(safeLimit);

    return { parties };
  }

  // ─── Call Sessions ──────────────────────────────────────────────────────────

  async createCall(
    coupleId: string | null | undefined,
    userId: string,
    input: CreateCallInput,
  ) {
    const couple = this.requireCouple(coupleId);

    const partnerId = await this.gateway.resolvePartnerId(userId);
    if (!partnerId) {
      throw new BadRequestException('No partner found to call');
    }

    const [call] = await this.db
      .insert(schema.callSessions)
      .values({
        coupleId: couple,
        callerId: userId,
        calleeId: partnerId,
        type: input.type,
        status: input.status ?? 'ringing',
      })
      .returning();

    if (!call) {
      throw new BadRequestException('Failed to create call session');
    }

    return { call };
  }

  async updateCall(
    id: string,
    coupleId: string | null | undefined,
    userId: string,
    input: UpdateCallInput,
  ) {
    const couple = this.requireCouple(coupleId);

    const [existing] = await this.db
      .select()
      .from(schema.callSessions)
      .where(
        and(
          eq(schema.callSessions.id, id),
          eq(schema.callSessions.coupleId, couple),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Call session not found');
    }

    if (existing.callerId !== userId && existing.calleeId !== userId) {
      throw new ForbiddenException('Not a participant in this call');
    }

    const updates: Partial<typeof schema.callSessions.$inferInsert> = {
      status: input.status,
    };

    if (input.durationSec !== undefined) {
      updates.durationSec = input.durationSec;
    }

    if (input.status === 'ongoing' && !existing.startedAt) {
      updates.startedAt = new Date();
    }

    if (
      input.status === 'ended' ||
      input.status === 'missed' ||
      input.status === 'declined'
    ) {
      updates.endedAt = new Date();
    }

    const [call] = await this.db
      .update(schema.callSessions)
      .set(updates)
      .where(eq(schema.callSessions.id, id))
      .returning();

    return { call };
  }

  async getCallHistory(coupleId: string | null | undefined, limit = 20) {
    const couple = this.requireCouple(coupleId);
    const safeLimit = limit > 0 ? limit : 20;

    const caller = alias(schema.users, 'caller');
    const callee = alias(schema.users, 'callee');

    const calls = await this.db
      .select({
        id: schema.callSessions.id,
        coupleId: schema.callSessions.coupleId,
        callerId: schema.callSessions.callerId,
        calleeId: schema.callSessions.calleeId,
        type: schema.callSessions.type,
        status: schema.callSessions.status,
        startedAt: schema.callSessions.startedAt,
        endedAt: schema.callSessions.endedAt,
        durationSec: schema.callSessions.durationSec,
        createdAt: schema.callSessions.createdAt,
        callerDisplayName: caller.displayName,
        callerAvatarUrl: caller.avatarUrl,
        calleeDisplayName: callee.displayName,
        calleeAvatarUrl: callee.avatarUrl,
      })
      .from(schema.callSessions)
      .leftJoin(caller, eq(schema.callSessions.callerId, caller.id))
      .leftJoin(callee, eq(schema.callSessions.calleeId, callee.id))
      .where(eq(schema.callSessions.coupleId, couple))
      .orderBy(desc(schema.callSessions.createdAt))
      .limit(safeLimit);

    return { calls };
  }
}
