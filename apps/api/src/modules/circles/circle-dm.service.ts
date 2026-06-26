import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { FcmService } from '../push/fcm.service';
import { CirclesService } from './circles.service';

// ─── Pure helpers (unit-tested directly; no DB / DI) ────────────────────────────

/**
 * Order two circle ids into the canonical [lo, hi] pair so a single
 * `(circleLoId, circleHiId)` unique index makes find-or-create race-safe
 * regardless of which side initiates the conversation.
 */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** A single accepted follow edge (direction-bearing). */
export interface FollowEdgeRow {
  followerCircleId: string;
  followingCircleId: string;
}

/**
 * Pure mutual-gate decision: given the set of ACCEPTED follow edges that touch
 * the pair, return true iff there is an edge a->b AND an edge b->a. Caller is
 * responsible for only passing accepted edges. Self-pairs are never mutual.
 */
export function isMutualFromRows(
  circleAId: string,
  circleBId: string,
  rows: FollowEdgeRow[],
): boolean {
  if (circleAId === circleBId) return false;
  const aFollowsB = rows.some(
    (r) => r.followerCircleId === circleAId && r.followingCircleId === circleBId,
  );
  const bFollowsA = rows.some(
    (r) => r.followerCircleId === circleBId && r.followingCircleId === circleAId,
  );
  return aFollowsB && bFollowsA;
}

// ─── Service ────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE = 30;
const MAX_PAGE = 50;
const PREVIEW_LEN = 280;

type ConversationRow = typeof schema.circleConversations.$inferSelect;

@Injectable()
export class CircleDmService {
  private readonly logger = new Logger(CircleDmService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
    private readonly fcm: FcmService,
    private readonly circles: CirclesService,
  ) {}

  // ─── Cursor (createdAt + id keyset) ──────────────────────────────────────────

  private encodeCursor(createdAt: Date | null, id: string): string {
    const ts = createdAt ? createdAt.getTime() : 0;
    return Buffer.from(`${ts}:${id}`).toString('base64');
  }

  private decodeCursor(cursor?: string): { ts: number; id: string } | null {
    if (!cursor) return null;
    try {
      const raw = Buffer.from(cursor, 'base64').toString('utf8');
      const sep = raw.lastIndexOf(':');
      if (sep === -1) return null;
      const ts = Number(raw.slice(0, sep));
      const id = raw.slice(sep + 1);
      if (!Number.isFinite(ts) || !id) return null;
      return { ts, id };
    } catch {
      return null;
    }
  }

  private clampLimit(limit?: number): number {
    if (!limit || limit < 1) return DEFAULT_PAGE;
    return Math.min(limit, MAX_PAGE);
  }

  private preview(content?: string | null, mediaUrls?: string[] | null): string {
    const text = content?.trim();
    if (text) return text.slice(0, PREVIEW_LEN);
    if (mediaUrls && mediaUrls.length > 0) return '📷 Photo';
    return '';
  }

  /** The "other" circle id in a conversation relative to the caller's circle. */
  private otherCircleId(conv: ConversationRow, myCircleId: string): string {
    return conv.circleLoId === myCircleId ? conv.circleHiId : conv.circleLoId;
  }

  /** Throw unless the caller's circle is one of the conversation's pair. */
  private async loadParticipantConversation(
    conversationId: string,
    myCircleId: string,
  ): Promise<ConversationRow> {
    const [conv] = await this.db
      .select()
      .from(schema.circleConversations)
      .where(eq(schema.circleConversations.id, conversationId))
      .limit(1);
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.circleLoId !== myCircleId && conv.circleHiId !== myCircleId) {
      // Don't leak existence to non-participants.
      throw new NotFoundException('Conversation not found');
    }
    return conv;
  }

  /** All participant user ids (both circles' couples) for fan-out. */
  private async participantUserIds(conv: ConversationRow): Promise<string[]> {
    const [lo, hi] = await Promise.all([
      this.circles.circleUserIdsPublic(conv.circleLoId),
      this.circles.circleUserIdsPublic(conv.circleHiId),
    ]);
    return Array.from(new Set([...lo, ...hi]));
  }

  // ─── GET /circles/conversations ──────────────────────────────────────────────

  async listConversations(coupleId: string, cursor?: string, limit?: number) {
    const myCircle = await this.circles.requireMyCirclePublic(coupleId);
    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    const conditions = [
      or(
        eq(schema.circleConversations.circleLoId, myCircle.id),
        eq(schema.circleConversations.circleHiId, myCircle.id),
      ),
    ];
    // Keyset on lastMessageAt+id; conversations with no messages sort last (epoch 0).
    if (decoded) {
      conditions.push(
        sql`(coalesce(${schema.circleConversations.lastMessageAt}, to_timestamp(0)), ${schema.circleConversations.id}) < (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.circleConversations)
      .where(and(...conditions))
      .orderBy(
        desc(sql`coalesce(${schema.circleConversations.lastMessageAt}, to_timestamp(0))`),
        desc(schema.circleConversations.id),
      )
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;

    const otherIds = sliced.map((c) => this.otherCircleId(c, myCircle.id));
    const [otherCircles, reads] = await Promise.all([
      otherIds.length
        ? this.db
            .select({
              id: schema.circles.id,
              handle: schema.circles.handle,
              name: schema.circles.name,
              avatarUrl: schema.circles.avatarUrl,
            })
            .from(schema.circles)
            .where(inArray(schema.circles.id, otherIds))
        : Promise.resolve([] as { id: string; handle: string | null; name: string; avatarUrl: string | null }[]),
      sliced.length
        ? this.db
            .select({
              conversationId: schema.circleConversationReads.conversationId,
              lastReadAt: schema.circleConversationReads.lastReadAt,
            })
            .from(schema.circleConversationReads)
            .where(
              and(
                eq(schema.circleConversationReads.circleId, myCircle.id),
                inArray(
                  schema.circleConversationReads.conversationId,
                  sliced.map((c) => c.id),
                ),
              ),
            )
        : Promise.resolve([] as { conversationId: string; lastReadAt: Date | null }[]),
    ]);

    const circleById = new Map(otherCircles.map((c) => [c.id, c]));
    const readByConv = new Map(reads.map((r) => [r.conversationId, r.lastReadAt]));

    // Unread = messages in this conversation after my lastReadAt, not sent by me.
    const unreadByConv = await this.unreadCounts(
      sliced.map((c) => c.id),
      myCircle.id,
      readByConv,
    );

    const conversations = sliced.map((c) => {
      const other = circleById.get(this.otherCircleId(c, myCircle.id));
      return {
        id: c.id,
        otherCircle: other
          ? this.circles.circleSummaryPublic(other)
          : null,
        lastMessagePreview: c.lastMessagePreview ?? null,
        lastMessageAt: c.lastMessageAt,
        unreadCount: unreadByConv.get(c.id) ?? 0,
      };
    });

    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeCursor(last.lastMessageAt ?? new Date(0), last.id)
        : null;

    return { conversations, nextCursor };
  }

  // ─── GET /circles/conversations/:id ──────────────────────────────────────────

  /**
   * A single conversation summary for the caller's circle. Used by the thread
   * header so it can resolve the other circle directly instead of scanning the
   * paginated inbox (which may not contain it past the first page).
   */
  async getConversation(conversationId: string, coupleId: string) {
    const myCircle = await this.circles.requireMyCirclePublic(coupleId);
    const conv = await this.loadParticipantConversation(conversationId, myCircle.id);
    const otherId = this.otherCircleId(conv, myCircle.id);

    const [other] = await this.db
      .select({
        id: schema.circles.id,
        handle: schema.circles.handle,
        name: schema.circles.name,
        avatarUrl: schema.circles.avatarUrl,
      })
      .from(schema.circles)
      .where(eq(schema.circles.id, otherId))
      .limit(1);

    const [read] = await this.db
      .select({ lastReadAt: schema.circleConversationReads.lastReadAt })
      .from(schema.circleConversationReads)
      .where(
        and(
          eq(schema.circleConversationReads.circleId, myCircle.id),
          eq(schema.circleConversationReads.conversationId, conv.id),
        ),
      )
      .limit(1);

    const readByConv = new Map<string, Date | null>([
      [conv.id, read?.lastReadAt ?? null],
    ]);
    const unreadByConv = await this.unreadCounts([conv.id], myCircle.id, readByConv);

    return {
      conversation: {
        id: conv.id,
        otherCircle: other ? this.circles.circleSummaryPublic(other) : null,
        lastMessagePreview: conv.lastMessagePreview ?? null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: unreadByConv.get(conv.id) ?? 0,
      },
    };
  }

  /** Per-conversation unread counts for the caller's circle. */
  private async unreadCounts(
    conversationIds: string[],
    myCircleId: string,
    readByConv: Map<string, Date | null>,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (conversationIds.length === 0) return result;

    const rows = await this.db
      .select({
        conversationId: schema.circleConversationMessages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.circleConversationMessages)
      .where(
        and(
          inArray(schema.circleConversationMessages.conversationId, conversationIds),
          // not sent by my circle
          sql`${schema.circleConversationMessages.senderCircleId} <> ${myCircleId}`,
          // newer than my last read (or all, if never read)
          or(
            ...conversationIds.map((cid) => {
              const lastRead = readByConv.get(cid);
              return lastRead
                ? sql`(${schema.circleConversationMessages.conversationId} = ${cid} and ${schema.circleConversationMessages.createdAt} > ${lastRead})`
                : sql`(${schema.circleConversationMessages.conversationId} = ${cid})`;
            }),
          ),
        ),
      )
      .groupBy(schema.circleConversationMessages.conversationId);

    for (const r of rows) result.set(r.conversationId, r.count);
    return result;
  }

  // ─── POST /circles/:idOrHandle/conversations ─────────────────────────────────

  async openConversation(idOrHandle: string, coupleId: string) {
    const myCircle = await this.circles.requireMyCirclePublic(coupleId);
    const target = await this.circles.resolveCirclePublic(idOrHandle);

    if (target.id === myCircle.id) {
      throw new ForbiddenException('You cannot message your own circle');
    }

    const mutual = await this.circles.isMutualFollow(myCircle.id, target.id);
    if (!mutual) {
      throw new ForbiddenException('You can only message circles you mutually follow');
    }

    const conv = await this.findOrCreateConversation(myCircle.id, target.id);
    return {
      conversation: {
        id: conv.id,
        otherCircle: this.circles.circleSummaryPublic(target),
        lastMessagePreview: conv.lastMessagePreview ?? null,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: 0,
      },
    };
  }

  /** Find-or-create on the ordered pair; race-safe via 23505 -> re-select. */
  private async findOrCreateConversation(
    circleAId: string,
    circleBId: string,
  ): Promise<ConversationRow> {
    const [lo, hi] = orderPair(circleAId, circleBId);

    const existing = await this.selectByPair(lo, hi);
    if (existing) return existing;

    try {
      const [created] = await this.db
        .insert(schema.circleConversations)
        .values({ circleLoId: lo, circleHiId: hi })
        .returning();
      if (created) return created;
    } catch (err: unknown) {
      if (!this.isUniqueViolation(err)) throw err;
    }

    // Lost the race (or returning() empty) — re-select the now-existing row.
    const again = await this.selectByPair(lo, hi);
    if (!again) throw new NotFoundException('Conversation not found');
    return again;
  }

  private async selectByPair(lo: string, hi: string): Promise<ConversationRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.circleConversations)
      .where(
        and(
          eq(schema.circleConversations.circleLoId, lo),
          eq(schema.circleConversations.circleHiId, hi),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }

  // ─── GET /circles/conversations/:id/messages ─────────────────────────────────

  async listMessages(
    conversationId: string,
    coupleId: string,
    cursor?: string,
    limit?: number,
  ) {
    const myCircle = await this.circles.requireMyCirclePublic(coupleId);
    await this.loadParticipantConversation(conversationId, myCircle.id);

    const take = this.clampLimit(limit);
    const decoded = this.decodeCursor(cursor);

    const conditions = [eq(schema.circleConversationMessages.conversationId, conversationId)];
    if (decoded) {
      conditions.push(
        sql`(${schema.circleConversationMessages.createdAt}, ${schema.circleConversationMessages.id}) < (to_timestamp(${
          decoded.ts / 1000
        }), ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        id: schema.circleConversationMessages.id,
        conversationId: schema.circleConversationMessages.conversationId,
        senderUserId: schema.circleConversationMessages.senderUserId,
        senderCircleId: schema.circleConversationMessages.senderCircleId,
        content: schema.circleConversationMessages.content,
        mediaUrls: schema.circleConversationMessages.mediaUrls,
        createdAt: schema.circleConversationMessages.createdAt,
        senderName: schema.users.displayName,
        senderAvatarUrl: schema.users.avatarUrl,
      })
      .from(schema.circleConversationMessages)
      .leftJoin(schema.users, eq(schema.circleConversationMessages.senderUserId, schema.users.id))
      .where(and(...conditions))
      .orderBy(
        desc(schema.circleConversationMessages.createdAt),
        desc(schema.circleConversationMessages.id),
      )
      .limit(take + 1);

    const hasMore = rows.length > take;
    const sliced = hasMore ? rows.slice(0, take) : rows;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null;

    return {
      messages: sliced.map((m) => this.serializeMessage(m)),
      nextCursor,
    };
  }

  private serializeMessage(m: {
    id: string;
    conversationId: string;
    senderUserId: string;
    senderCircleId: string;
    content: string | null;
    mediaUrls: string[] | null;
    createdAt: Date | null;
    senderName?: string | null;
    senderAvatarUrl?: string | null;
  }) {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderUserId: m.senderUserId,
      senderCircleId: m.senderCircleId,
      content: m.content ?? undefined,
      mediaUrls: m.mediaUrls ?? [],
      // Emit an ISO string (not a raw Date) so the realtime socket payload —
      // which bypasses NestJS JSON serialization — matches the HTTP response and
      // the client's `createdAt: string | null` type.
      createdAt: m.createdAt?.toISOString() ?? null,
      senderName: m.senderName ?? null,
      senderAvatarUrl: m.senderAvatarUrl ?? null,
    };
  }

  // ─── POST /circles/conversations/:id/messages ────────────────────────────────

  async sendMessage(
    conversationId: string,
    userId: string,
    coupleId: string,
    input: { content?: string; mediaUrls?: string[] },
  ) {
    const myCircle = await this.circles.requireMyCirclePublic(coupleId);
    const conv = await this.loadParticipantConversation(conversationId, myCircle.id);
    const otherId = this.otherCircleId(conv, myCircle.id);

    // Re-check mutual on send (a follow may have been removed since open).
    const mutual = await this.circles.isMutualFollow(myCircle.id, otherId);
    if (!mutual) {
      throw new ForbiddenException('You can only message circles you mutually follow');
    }

    const content = input.content?.trim() || null;
    const mediaUrls = input.mediaUrls && input.mediaUrls.length ? input.mediaUrls : null;
    const now = new Date();

    const message = await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(schema.circleConversationMessages)
        .values({
          conversationId,
          senderUserId: userId,
          senderCircleId: myCircle.id,
          content,
          mediaUrls,
        })
        .returning();

      await tx
        .update(schema.circleConversations)
        .set({
          lastMessageAt: now,
          lastMessagePreview: this.preview(content, mediaUrls),
          updatedAt: now,
        })
        .where(eq(schema.circleConversations.id, conversationId));

      // Sender's own read marker advances so they don't see their msg as unread.
      await tx
        .insert(schema.circleConversationReads)
        .values({ conversationId, circleId: myCircle.id, lastReadAt: now })
        .onConflictDoUpdate({
          target: [
            schema.circleConversationReads.conversationId,
            schema.circleConversationReads.circleId,
          ],
          set: { lastReadAt: now },
        });

      return inserted!;
    });

    const senderName = await this.displayName(userId);
    const payload = {
      conversationId,
      message: this.serializeMessage({ ...message, senderName }),
    };

    // Fan out realtime to all participant users (both couples).
    const allUserIds = await this.participantUserIds(conv);
    for (const uid of allUserIds) {
      this.gateway.emitToUser(uid, 'circle:dm:new', payload);
    }

    // Notify + push the OTHER circle's users (best-effort, like sendMessagePush).
    const recipientIds = (await this.circles.circleUserIdsPublic(otherId)).filter(
      (uid) => uid !== userId,
    );
    void this.notifyRecipients(recipientIds, conv, myCircle, senderName, content, mediaUrls);

    return { message: payload.message };
  }

  private async notifyRecipients(
    recipientIds: string[],
    conv: ConversationRow,
    senderCircle: { id: string; name: string; handle: string | null },
    senderName: string,
    content: string | null,
    mediaUrls: string[] | null,
  ): Promise<void> {
    const body = content
      ? `${content}`.slice(0, 120)
      : mediaUrls && mediaUrls.length
        ? 'Sent a photo'
        : 'Sent a message';
    for (const recipientId of recipientIds) {
      try {
        const recipientCoupleId = await this.userCoupleId(recipientId);
        await this.notifications.create({
          userId: recipientId,
          coupleId: recipientCoupleId ?? undefined,
          type: 'circle_dm',
          title: senderCircle.name || senderName,
          body,
          actionType: 'circle_dm',
          actionData: {
            conversationId: conv.id,
            circleId: senderCircle.id,
            handle: senderCircle.handle ?? undefined,
          },
        });
        await this.pushDm(recipientId, senderCircle.name || senderName, body, conv.id);
      } catch (e) {
        this.logger.warn(`circle_dm notify failed: ${(e as Error).message}`);
      }
    }
  }

  /** Best-effort FCM push to a recipient (mirrors gateway.sendMessagePush). */
  private async pushDm(
    recipientId: string,
    title: string,
    body: string,
    conversationId: string,
  ): Promise<void> {
    if (!this.fcm.enabled) return;
    try {
      const [recipient] = await this.db
        .select({ fcmToken: schema.users.fcmToken })
        .from(schema.users)
        .where(eq(schema.users.id, recipientId))
        .limit(1);
      if (!recipient?.fcmToken) return;
      await this.fcm.sendToToken(recipient.fcmToken, title, body, {
        type: 'circle_dm',
        conversationId,
      });
    } catch (e) {
      this.logger.warn(`circle_dm push failed: ${(e as Error).message}`);
    }
  }

  private async userCoupleId(userId: string): Promise<string | null> {
    const [u] = await this.db
      .select({ coupleId: schema.users.coupleId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return u?.coupleId ?? null;
  }

  private async displayName(userId: string): Promise<string> {
    const [u] = await this.db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    return u?.displayName ?? 'Someone';
  }

  // ─── POST /circles/conversations/:id/read ────────────────────────────────────

  async markRead(conversationId: string, coupleId: string) {
    const myCircle = await this.circles.requireMyCirclePublic(coupleId);
    const conv = await this.loadParticipantConversation(conversationId, myCircle.id);
    const now = new Date();

    await this.db
      .insert(schema.circleConversationReads)
      .values({ conversationId, circleId: myCircle.id, lastReadAt: now })
      .onConflictDoUpdate({
        target: [
          schema.circleConversationReads.conversationId,
          schema.circleConversationReads.circleId,
        ],
        set: { lastReadAt: now },
      });

    // Emit read receipt to all participants (both couples) so the OTHER side can
    // clear their "delivered" → "read" indicator.
    const payload = { conversationId, circleId: myCircle.id, lastReadAt: now.toISOString() };
    const allUserIds = await this.participantUserIds(conv);
    for (const uid of allUserIds) {
      this.gateway.emitToUser(uid, 'circle:dm:read', payload);
    }

    return { success: true, lastReadAt: now };
  }
}
