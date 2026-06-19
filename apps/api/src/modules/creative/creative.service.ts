import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { StorageService } from '../media/storage.service';
import { EventsGateway } from '../../gateway/events.gateway';

@Injectable()
export class CreativeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly storage: StorageService,
    private readonly gateway: EventsGateway,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private requireCouple(coupleId: string | null | undefined): string {
    if (!coupleId) {
      throw new BadRequestException('You must be in a couple');
    }
    return coupleId;
  }

  /** Resolve the partner user id for a couple, given the acting user. */
  private async resolveReceiverId(
    coupleId: string,
    userId: string,
  ): Promise<string | null> {
    const [couple] = await this.db
      .select({
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) return null;

    return couple.partner1Id === userId
      ? couple.partner2Id
      : couple.partner1Id;
  }

  // ─── Custom Emojis ───────────────────────────────────────────────────────────

  async createEmoji(
    userId: string,
    coupleId: string | null,
    body: {
      name: string;
      image: string;
      category?: string;
      isAnimated?: boolean;
    },
  ) {
    const cid = this.requireCouple(coupleId);

    if (!body.name || !body.image) {
      throw new BadRequestException('name and image are required');
    }

    const stored = await this.storage.storeDataUrl(body.image, cid, 'emoji');

    const [emoji] = await this.db
      .insert(schema.customEmojis)
      .values({
        coupleId: cid,
        createdBy: userId,
        name: body.name,
        imageUrl: stored.cdnUrl,
        category: body.category ?? 'custom',
        isAnimated: body.isAnimated ?? false,
      })
      .returning();

    return { emoji };
  }

  async listEmojis(coupleId: string | null) {
    const cid = this.requireCouple(coupleId);

    const emojis = await this.db
      .select()
      .from(schema.customEmojis)
      .where(eq(schema.customEmojis.coupleId, cid))
      .orderBy(desc(schema.customEmojis.createdAt));

    return { emojis };
  }

  async useEmoji(coupleId: string | null, id: string) {
    const cid = this.requireCouple(coupleId);

    const [emoji] = await this.db
      .update(schema.customEmojis)
      .set({ useCount: sql`${schema.customEmojis.useCount} + 1` })
      .where(
        and(
          eq(schema.customEmojis.id, id),
          eq(schema.customEmojis.coupleId, cid),
        ),
      )
      .returning();

    if (!emoji) {
      throw new NotFoundException('Emoji not found');
    }

    return { emoji };
  }

  async deleteEmoji(coupleId: string | null, id: string) {
    const cid = this.requireCouple(coupleId);

    const [deleted] = await this.db
      .delete(schema.customEmojis)
      .where(
        and(
          eq(schema.customEmojis.id, id),
          eq(schema.customEmojis.coupleId, cid),
        ),
      )
      .returning({ id: schema.customEmojis.id });

    if (!deleted) {
      throw new NotFoundException('Emoji not found');
    }

    return { success: true };
  }

  // ─── SoundBoard ────────────────────────────────────────────────────────────

  async createSound(
    userId: string,
    coupleId: string | null,
    body: {
      name: string;
      audio: string;
      emoji?: string;
      category?: string;
      color?: string;
      duration?: number;
    },
  ) {
    const cid = this.requireCouple(coupleId);

    if (!body.name || !body.audio) {
      throw new BadRequestException('name and audio are required');
    }

    const stored = await this.storage.storeDataUrl(body.audio, cid, 'sound');

    const [sound] = await this.db
      .insert(schema.soundboardSounds)
      .values({
        coupleId: cid,
        createdBy: userId,
        name: body.name,
        audioUrl: stored.cdnUrl,
        emoji: body.emoji ?? null,
        category: body.category ?? 'custom',
        color: body.color ?? null,
        duration: body.duration ?? null,
      })
      .returning();

    return { sound };
  }

  async listSounds(coupleId: string | null) {
    const cid = this.requireCouple(coupleId);

    const sounds = await this.db
      .select()
      .from(schema.soundboardSounds)
      .where(eq(schema.soundboardSounds.coupleId, cid))
      .orderBy(desc(schema.soundboardSounds.createdAt));

    return { sounds };
  }

  async playSound(userId: string, coupleId: string | null, id: string) {
    const cid = this.requireCouple(coupleId);

    const [sound] = await this.db
      .update(schema.soundboardSounds)
      .set({ useCount: sql`${schema.soundboardSounds.useCount} + 1` })
      .where(
        and(
          eq(schema.soundboardSounds.id, id),
          eq(schema.soundboardSounds.coupleId, cid),
        ),
      )
      .returning();

    if (!sound) {
      throw new NotFoundException('Sound not found');
    }

    const partnerId = await this.gateway.resolvePartnerId(userId);
    if (partnerId) {
      this.gateway.emitToUser(partnerId, 'soundboard:play', {
        soundId: sound.id,
        audioUrl: sound.audioUrl,
        name: sound.name,
      });
    }

    return { success: true };
  }

  async deleteSound(coupleId: string | null, id: string) {
    const cid = this.requireCouple(coupleId);

    const [deleted] = await this.db
      .delete(schema.soundboardSounds)
      .where(
        and(
          eq(schema.soundboardSounds.id, id),
          eq(schema.soundboardSounds.coupleId, cid),
        ),
      )
      .returning({ id: schema.soundboardSounds.id });

    if (!deleted) {
      throw new NotFoundException('Sound not found');
    }

    return { success: true };
  }

  // ─── Paintings (collaborative) ───────────────────────────────────────────────

  async createPainting(
    userId: string,
    coupleId: string | null,
    body: {
      title?: string;
      width?: number;
      height?: number;
      backgroundColor?: string;
    },
  ) {
    const cid = this.requireCouple(coupleId);

    const [painting] = await this.db
      .insert(schema.paintings)
      .values({
        coupleId: cid,
        createdBy: userId,
        title: body.title ?? null,
        width: body.width ?? 1024,
        height: body.height ?? 768,
        backgroundColor: body.backgroundColor ?? '#ffffff',
        status: 'active',
      })
      .returning();

    if (!painting) {
      throw new BadRequestException('Failed to create painting');
    }

    return { painting, sessionId: painting.id };
  }

  async listPaintings(coupleId: string | null) {
    const cid = this.requireCouple(coupleId);

    const paintings = await this.db
      .select()
      .from(schema.paintings)
      .where(eq(schema.paintings.coupleId, cid))
      .orderBy(desc(schema.paintings.createdAt));

    return { paintings, total: paintings.length };
  }

  async getPainting(coupleId: string | null, id: string) {
    const cid = this.requireCouple(coupleId);

    const [painting] = await this.db
      .select()
      .from(schema.paintings)
      .where(
        and(eq(schema.paintings.id, id), eq(schema.paintings.coupleId, cid)),
      )
      .limit(1);

    if (!painting) {
      throw new NotFoundException('Painting not found');
    }

    return { painting };
  }

  async updatePainting(
    coupleId: string | null,
    id: string,
    body: {
      strokes?: unknown[];
      imageUrl?: string;
      thumbnailUrl?: string;
      title?: string;
      status?: string;
    },
  ) {
    const cid = this.requireCouple(coupleId);

    const [existing] = await this.db
      .select({ id: schema.paintings.id })
      .from(schema.paintings)
      .where(
        and(eq(schema.paintings.id, id), eq(schema.paintings.coupleId, cid)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Painting not found');
    }

    const updates: Partial<typeof schema.paintings.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.strokes !== undefined) {
      updates.strokes = body.strokes;
    }
    if (body.title !== undefined) {
      updates.title = body.title;
    }
    if (body.status !== undefined) {
      updates.status = body.status;
    }
    if (body.imageUrl !== undefined) {
      updates.imageUrl = body.imageUrl.startsWith('data:')
        ? (await this.storage.storeDataUrl(body.imageUrl, cid, 'painting'))
            .cdnUrl
        : body.imageUrl;
    }
    if (body.thumbnailUrl !== undefined) {
      updates.thumbnailUrl = body.thumbnailUrl.startsWith('data:')
        ? (await this.storage.storeDataUrl(body.thumbnailUrl, cid, 'painting'))
            .cdnUrl
        : body.thumbnailUrl;
    }

    const [painting] = await this.db
      .update(schema.paintings)
      .set(updates)
      .where(
        and(eq(schema.paintings.id, id), eq(schema.paintings.coupleId, cid)),
      )
      .returning();

    if (!painting) {
      throw new NotFoundException('Painting not found');
    }

    return { painting };
  }

  async deletePainting(coupleId: string | null, id: string) {
    const cid = this.requireCouple(coupleId);

    const [deleted] = await this.db
      .delete(schema.paintings)
      .where(
        and(eq(schema.paintings.id, id), eq(schema.paintings.coupleId, cid)),
      )
      .returning({ id: schema.paintings.id });

    if (!deleted) {
      throw new NotFoundException('Painting not found');
    }

    return { success: true };
  }

  // ─── Scribbles ───────────────────────────────────────────────────────────────

  async createScribble(
    userId: string,
    coupleId: string | null,
    body: {
      image: string;
      strokes?: unknown[];
      backgroundColor?: string;
      sendAsMessage?: boolean;
    },
  ) {
    const cid = this.requireCouple(coupleId);

    if (!body.image) {
      throw new BadRequestException('image is required');
    }

    const stored = await this.storage.storeDataUrl(body.image, cid, 'scribble');
    const imageUrl = stored.cdnUrl;

    let message: typeof schema.messages.$inferSelect | undefined;
    let messageId: string | null = null;

    if (body.sendAsMessage) {
      const receiverId = await this.resolveReceiverId(cid, userId);
      if (!receiverId) {
        throw new BadRequestException('No partner to send the scribble to');
      }

      const [created] = await this.db
        .insert(schema.messages)
        .values({
          coupleId: cid,
          senderId: userId,
          receiverId,
          content: '🎨 Sent a scribble',
          messageType: 'scribble',
          mediaUrls: [imageUrl],
        })
        .returning();

      message = created;
      messageId = created?.id ?? null;

      if (message) {
        this.gateway.emitToUser(receiverId, 'message:new', message);
      }
    }

    const [scribble] = await this.db
      .insert(schema.scribbles)
      .values({
        coupleId: cid,
        createdBy: userId,
        imageUrl,
        strokes: body.strokes ?? [],
        backgroundColor: body.backgroundColor ?? '#ffffff',
        messageId,
      })
      .returning();

    return message ? { scribble, message } : { scribble };
  }

  async listScribbles(coupleId: string | null) {
    const cid = this.requireCouple(coupleId);

    const scribbles = await this.db
      .select()
      .from(schema.scribbles)
      .where(eq(schema.scribbles.coupleId, cid))
      .orderBy(desc(schema.scribbles.createdAt));

    return { scribbles };
  }
}
