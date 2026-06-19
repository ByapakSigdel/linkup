import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, desc, sql, inArray } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

interface CreateCircleInput {
  name: string;
  description?: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
  maxMembers?: number;
}

interface UpdateCircleInput {
  name?: string;
  description?: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
}

interface CreatePostInput {
  content: string;
  mediaUrls?: string[];
  type?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CirclesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private generateInviteCode(): string {
    return `circle_${crypto.randomBytes(5).toString('hex')}`;
  }

  /** Fetch a circle or throw. */
  private async getCircleOrThrow(circleId: string) {
    const [circle] = await this.db
      .select()
      .from(schema.circles)
      .where(eq(schema.circles.id, circleId))
      .limit(1);

    if (!circle) {
      throw new NotFoundException('Circle not found');
    }
    return circle;
  }

  /** Return the membership row for a couple in a circle, or null. */
  private async getMembership(circleId: string, coupleId: string) {
    const [membership] = await this.db
      .select()
      .from(schema.circleMembers)
      .where(
        and(
          eq(schema.circleMembers.circleId, circleId),
          eq(schema.circleMembers.coupleId, coupleId),
        ),
      )
      .limit(1);

    return membership ?? null;
  }

  /** Ensure the couple is a member of the circle; returns the membership row. */
  private async requireMembership(circleId: string, coupleId: string) {
    if (!coupleId) {
      throw new BadRequestException('You must be part of a couple');
    }
    const membership = await this.getMembership(circleId, coupleId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this circle');
    }
    return membership;
  }

  /** Ensure the couple is an admin of the circle; returns the membership row. */
  private async requireAdmin(circleId: string, coupleId: string) {
    const membership = await this.requireMembership(circleId, coupleId);
    if (membership.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return membership;
  }

  /** All user ids (partner1 + partner2) of every member couple of a circle. */
  private async getMemberUserIds(circleId: string): Promise<string[]> {
    const members = await this.db
      .select({ coupleId: schema.circleMembers.coupleId })
      .from(schema.circleMembers)
      .where(eq(schema.circleMembers.circleId, circleId));

    const coupleIds = members.map((m) => m.coupleId);
    if (coupleIds.length === 0) return [];

    const memberCouples = await this.db
      .select({
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.couples)
      .where(inArray(schema.couples.id, coupleIds));

    const userIds = new Set<string>();
    for (const c of memberCouples) {
      if (c.partner1Id) userIds.add(c.partner1Id);
      if (c.partner2Id) userIds.add(c.partner2Id);
    }
    return Array.from(userIds);
  }

  // ─── 1. Create circle ──────────────────────────────────────────────────────────

  async createCircle(
    userId: string,
    coupleId: string,
    input: CreateCircleInput,
  ) {
    if (!coupleId) {
      throw new BadRequestException('You must be part of a couple to create a circle');
    }

    const [circle] = await this.db
      .insert(schema.circles)
      .values({
        name: input.name,
        description: input.description,
        coverImageUrl: input.coverImageUrl,
        createdByCoupleId: coupleId,
        createdByUserId: userId,
        isPrivate: input.isPrivate ?? true,
        maxMembers: input.maxMembers ?? 10,
        inviteCode: this.generateInviteCode(),
        memberCount: 1,
        postCount: 0,
      })
      .returning();

    if (!circle) {
      throw new BadRequestException('Failed to create circle');
    }

    await this.db.insert(schema.circleMembers).values({
      circleId: circle.id,
      coupleId,
      role: 'admin',
    });

    return { circle };
  }

  // ─── 2. List circles ─────────────────────────────────────────────────────────

  async listCircles(coupleId: string, type: 'created' | 'joined' | 'all' = 'all') {
    if (!coupleId) {
      return { circles: [], total: 0 };
    }

    // Circle ids the couple is a member of.
    const memberships = await this.db
      .select({
        circleId: schema.circleMembers.circleId,
        role: schema.circleMembers.role,
      })
      .from(schema.circleMembers)
      .where(eq(schema.circleMembers.coupleId, coupleId));

    const membershipMap = new Map(memberships.map((m) => [m.circleId, m.role]));
    const memberCircleIds = memberships.map((m) => m.circleId);

    let rows: (typeof schema.circles.$inferSelect)[] = [];

    if (type === 'created') {
      rows = await this.db
        .select()
        .from(schema.circles)
        .where(eq(schema.circles.createdByCoupleId, coupleId))
        .orderBy(desc(schema.circles.createdAt));
    } else if (type === 'joined') {
      if (memberCircleIds.length === 0) return { circles: [], total: 0 };
      rows = await this.db
        .select()
        .from(schema.circles)
        .where(inArray(schema.circles.id, memberCircleIds))
        .orderBy(desc(schema.circles.createdAt));
    } else {
      // all: created OR member
      const conditions = [eq(schema.circles.createdByCoupleId, coupleId)];
      if (memberCircleIds.length > 0) {
        conditions.push(inArray(schema.circles.id, memberCircleIds));
      }
      rows = await this.db
        .select()
        .from(schema.circles)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .orderBy(desc(schema.circles.createdAt));
    }

    const circles = rows.map((c) => ({
      ...c,
      isAdmin:
        c.createdByCoupleId === coupleId || membershipMap.get(c.id) === 'admin',
    }));

    return { circles, total: circles.length };
  }

  // ─── 3. Circle details ─────────────────────────────────────────────────────────

  async getCircleDetails(circleId: string, userId: string, coupleId: string) {
    const circle = await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    // Members with couple + partner info.
    const memberRows = await this.db
      .select({
        memberId: schema.circleMembers.id,
        coupleId: schema.circleMembers.coupleId,
        role: schema.circleMembers.role,
        joinedAt: schema.circleMembers.joinedAt,
        coupleName: schema.couples.coupleName,
        coupleAvatarUrl: schema.couples.coupleAvatarUrl,
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.circleMembers)
      .leftJoin(
        schema.couples,
        eq(schema.circleMembers.coupleId, schema.couples.id),
      )
      .where(eq(schema.circleMembers.circleId, circleId));

    // Resolve partner display names.
    const partnerIds = new Set<string>();
    for (const m of memberRows) {
      if (m.partner1Id) partnerIds.add(m.partner1Id);
      if (m.partner2Id) partnerIds.add(m.partner2Id);
    }
    const userNameMap = new Map<string, string | null>();
    if (partnerIds.size > 0) {
      const userRows = await this.db
        .select({ id: schema.users.id, displayName: schema.users.displayName })
        .from(schema.users)
        .where(inArray(schema.users.id, Array.from(partnerIds)));
      for (const u of userRows) userNameMap.set(u.id, u.displayName);
    }

    const members = memberRows.map((m) => ({
      id: m.memberId,
      coupleId: m.coupleId,
      role: m.role,
      joinedAt: m.joinedAt,
      coupleName: m.coupleName,
      coupleAvatarUrl: m.coupleAvatarUrl,
      partnerNames: [
        m.partner1Id ? userNameMap.get(m.partner1Id) ?? null : null,
        m.partner2Id ? userNameMap.get(m.partner2Id) ?? null : null,
      ].filter((n): n is string => !!n),
    }));

    // Recent posts (last 10) with author + likedByMe.
    const postRows = await this.db
      .select({
        id: schema.circlePosts.id,
        circleId: schema.circlePosts.circleId,
        coupleId: schema.circlePosts.coupleId,
        authorId: schema.circlePosts.authorId,
        content: schema.circlePosts.content,
        type: schema.circlePosts.type,
        mediaUrls: schema.circlePosts.mediaUrls,
        metadata: schema.circlePosts.metadata,
        likeCount: schema.circlePosts.likeCount,
        commentCount: schema.circlePosts.commentCount,
        createdAt: schema.circlePosts.createdAt,
        authorName: schema.users.displayName,
        authorAvatarUrl: schema.users.avatarUrl,
      })
      .from(schema.circlePosts)
      .leftJoin(schema.users, eq(schema.circlePosts.authorId, schema.users.id))
      .where(eq(schema.circlePosts.circleId, circleId))
      .orderBy(desc(schema.circlePosts.createdAt))
      .limit(10);

    const recentPosts = await this.attachLikedByMe(postRows, userId);

    const memberCount = circle.memberCount ?? members.length;
    const postCount = circle.postCount ?? 0;
    const stats = {
      memberCount,
      postCount,
      activityScore: postCount * 2 + memberCount,
    };

    return { circle, members, recentPosts, stats };
  }

  // ─── 4. Update circle (admin) ──────────────────────────────────────────────────

  async updateCircle(
    circleId: string,
    coupleId: string,
    input: UpdateCircleInput,
  ) {
    await this.getCircleOrThrow(circleId);
    await this.requireAdmin(circleId, coupleId);

    const [circle] = await this.db
      .update(schema.circles)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.coverImageUrl !== undefined
          ? { coverImageUrl: input.coverImageUrl }
          : {}),
        ...(input.isPrivate !== undefined ? { isPrivate: input.isPrivate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.circles.id, circleId))
      .returning();

    return { circle };
  }

  // ─── 5. Delete circle (creator) ────────────────────────────────────────────────

  async deleteCircle(circleId: string, coupleId: string) {
    const circle = await this.getCircleOrThrow(circleId);

    if (circle.createdByCoupleId !== coupleId) {
      throw new ForbiddenException('Only the creator couple can delete this circle');
    }

    await this.db.delete(schema.circles).where(eq(schema.circles.id, circleId));

    return { success: true };
  }

  // ─── 6. Join circle ──────────────────────────────────────────────────────────

  async joinCircle(
    circleId: string,
    userId: string,
    coupleId: string,
    inviteCode?: string,
  ) {
    if (!coupleId) {
      throw new BadRequestException('You must be part of a couple to join a circle');
    }

    const circle = await this.getCircleOrThrow(circleId);

    const existing = await this.getMembership(circleId, coupleId);
    if (existing) {
      throw new BadRequestException('You are already a member of this circle');
    }

    if (circle.isPrivate) {
      if (!inviteCode || inviteCode !== circle.inviteCode) {
        throw new ForbiddenException('A valid invite code is required to join this circle');
      }
    }

    const maxMembers = circle.maxMembers ?? 10;
    if ((circle.memberCount ?? 0) >= maxMembers) {
      throw new BadRequestException('This circle is full');
    }

    const [membership] = await this.db
      .insert(schema.circleMembers)
      .values({
        circleId,
        coupleId,
        role: 'member',
      })
      .returning();

    await this.db
      .update(schema.circles)
      .set({
        memberCount: sql`${schema.circles.memberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.circles.id, circleId));

    // Notify the circle creator.
    await this.notifications.create({
      userId: circle.createdByUserId,
      coupleId: circle.createdByCoupleId,
      type: 'circle_join',
      title: 'New circle member',
      body: `A new couple joined "${circle.name}"`,
      actionType: 'circle',
      actionData: { circleId },
    });

    // Emit to all member users.
    const memberUserIds = await this.getMemberUserIds(circleId);
    for (const memberUserId of memberUserIds) {
      this.gateway.emitToUser(memberUserId, 'circle:member:joined', {
        circleId,
        coupleId,
        joinedByUserId: userId,
      });
    }

    return { membership };
  }

  // ─── 7. Leave circle ─────────────────────────────────────────────────────────

  async leaveCircle(circleId: string, coupleId: string) {
    const circle = await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    if (circle.createdByCoupleId === coupleId) {
      throw new BadRequestException(
        'The creator cannot leave the circle; delete it instead',
      );
    }

    await this.db
      .delete(schema.circleMembers)
      .where(
        and(
          eq(schema.circleMembers.circleId, circleId),
          eq(schema.circleMembers.coupleId, coupleId),
        ),
      );

    await this.db
      .update(schema.circles)
      .set({
        memberCount: sql`GREATEST(${schema.circles.memberCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.circles.id, circleId));

    return { success: true };
  }

  // ─── 8. Invite a couple (admin) ────────────────────────────────────────────────

  async inviteCouple(
    circleId: string,
    coupleId: string,
    invitedCoupleId: string,
    message?: string,
  ) {
    const circle = await this.getCircleOrThrow(circleId);
    await this.requireAdmin(circleId, coupleId);

    if (!invitedCoupleId) {
      throw new BadRequestException('coupleId is required');
    }

    const [invitedCouple] = await this.db
      .select({
        id: schema.couples.id,
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.couples)
      .where(eq(schema.couples.id, invitedCoupleId))
      .limit(1);

    if (!invitedCouple) {
      throw new NotFoundException('Invited couple not found');
    }

    const recipients = [invitedCouple.partner1Id, invitedCouple.partner2Id].filter(
      (id): id is string => !!id,
    );

    for (const recipientId of recipients) {
      await this.notifications.create({
        userId: recipientId,
        coupleId: invitedCoupleId,
        type: 'circle_invite',
        title: 'Circle invitation',
        body: message ?? `You've been invited to join "${circle.name}"`,
        actionType: 'circle',
        actionData: { circleId, inviteCode: circle.inviteCode },
      });
    }

    return {
      invitation: {
        circleId,
        inviteCode: circle.inviteCode,
        invitedCoupleId,
      },
    };
  }

  // ─── 9. List posts (member) ────────────────────────────────────────────────────

  async listPosts(
    circleId: string,
    userId: string,
    coupleId: string,
    limit = 20,
    type?: string,
  ) {
    await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    const conditions = [eq(schema.circlePosts.circleId, circleId)];
    if (type) {
      conditions.push(eq(schema.circlePosts.type, type));
    }

    const postRows = await this.db
      .select({
        id: schema.circlePosts.id,
        circleId: schema.circlePosts.circleId,
        coupleId: schema.circlePosts.coupleId,
        authorId: schema.circlePosts.authorId,
        content: schema.circlePosts.content,
        type: schema.circlePosts.type,
        mediaUrls: schema.circlePosts.mediaUrls,
        metadata: schema.circlePosts.metadata,
        likeCount: schema.circlePosts.likeCount,
        commentCount: schema.circlePosts.commentCount,
        createdAt: schema.circlePosts.createdAt,
        authorName: schema.users.displayName,
        authorAvatarUrl: schema.users.avatarUrl,
      })
      .from(schema.circlePosts)
      .leftJoin(schema.users, eq(schema.circlePosts.authorId, schema.users.id))
      .where(and(...conditions))
      .orderBy(desc(schema.circlePosts.createdAt))
      .limit(limit + 1);

    const hasMore = postRows.length > limit;
    const sliced = hasMore ? postRows.slice(0, limit) : postRows;
    const posts = await this.attachLikedByMe(sliced, userId);

    return { posts, hasMore };
  }

  // ─── 10. Create post (member) ──────────────────────────────────────────────────

  async createPost(
    circleId: string,
    userId: string,
    coupleId: string,
    input: CreatePostInput,
  ) {
    await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    const [post] = await this.db
      .insert(schema.circlePosts)
      .values({
        circleId,
        coupleId,
        authorId: userId,
        content: input.content,
        type: input.type ?? 'post',
        mediaUrls: input.mediaUrls ?? [],
        metadata: input.metadata,
        likeCount: 0,
        commentCount: 0,
      })
      .returning();

    await this.db
      .update(schema.circles)
      .set({
        postCount: sql`${schema.circles.postCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.circles.id, circleId));

    // Emit to all OTHER member users.
    const memberUserIds = await this.getMemberUserIds(circleId);
    for (const memberUserId of memberUserIds) {
      if (memberUserId === userId) continue;
      this.gateway.emitToUser(memberUserId, 'circle:post', { circleId, post });
    }

    return { post };
  }

  // ─── 11. Toggle like ───────────────────────────────────────────────────────────

  async toggleLike(circleId: string, postId: string, userId: string, coupleId: string) {
    await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    const [post] = await this.db
      .select()
      .from(schema.circlePosts)
      .where(
        and(
          eq(schema.circlePosts.id, postId),
          eq(schema.circlePosts.circleId, circleId),
        ),
      )
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [existing] = await this.db
      .select()
      .from(schema.postLikes)
      .where(
        and(
          eq(schema.postLikes.postId, postId),
          eq(schema.postLikes.userId, userId),
        ),
      )
      .limit(1);

    let liked: boolean;
    if (existing) {
      await this.db
        .delete(schema.postLikes)
        .where(eq(schema.postLikes.id, existing.id));
      await this.db
        .update(schema.circlePosts)
        .set({ likeCount: sql`GREATEST(${schema.circlePosts.likeCount} - 1, 0)` })
        .where(eq(schema.circlePosts.id, postId));
      liked = false;
    } else {
      await this.db.insert(schema.postLikes).values({ postId, userId });
      await this.db
        .update(schema.circlePosts)
        .set({ likeCount: sql`${schema.circlePosts.likeCount} + 1` })
        .where(eq(schema.circlePosts.id, postId));
      liked = true;
    }

    const [updated] = await this.db
      .select({ likeCount: schema.circlePosts.likeCount })
      .from(schema.circlePosts)
      .where(eq(schema.circlePosts.id, postId))
      .limit(1);

    const likeCount = updated?.likeCount ?? 0;

    // Emit to members.
    const memberUserIds = await this.getMemberUserIds(circleId);
    for (const memberUserId of memberUserIds) {
      this.gateway.emitToUser(memberUserId, 'circle:post:liked', {
        circleId,
        postId,
        userId,
        liked,
        likeCount,
      });
    }

    return { liked, likeCount };
  }

  // ─── 12. Add comment ───────────────────────────────────────────────────────────

  async addComment(
    circleId: string,
    postId: string,
    userId: string,
    coupleId: string,
    content: string,
  ) {
    await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    if (!content || !content.trim()) {
      throw new BadRequestException('Comment content is required');
    }

    const [post] = await this.db
      .select()
      .from(schema.circlePosts)
      .where(
        and(
          eq(schema.circlePosts.id, postId),
          eq(schema.circlePosts.circleId, circleId),
        ),
      )
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [comment] = await this.db
      .insert(schema.postComments)
      .values({ postId, userId, content })
      .returning();

    await this.db
      .update(schema.circlePosts)
      .set({ commentCount: sql`${schema.circlePosts.commentCount} + 1` })
      .where(eq(schema.circlePosts.id, postId));

    // Emit to members.
    const memberUserIds = await this.getMemberUserIds(circleId);
    for (const memberUserId of memberUserIds) {
      this.gateway.emitToUser(memberUserId, 'circle:comment', {
        circleId,
        postId,
        comment,
      });
    }

    return { comment };
  }

  // ─── 13. List comments ─────────────────────────────────────────────────────────

  async listComments(circleId: string, postId: string, coupleId: string) {
    await this.getCircleOrThrow(circleId);
    await this.requireMembership(circleId, coupleId);

    const [post] = await this.db
      .select({ id: schema.circlePosts.id })
      .from(schema.circlePosts)
      .where(
        and(
          eq(schema.circlePosts.id, postId),
          eq(schema.circlePosts.circleId, circleId),
        ),
      )
      .limit(1);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comments = await this.db
      .select({
        id: schema.postComments.id,
        postId: schema.postComments.postId,
        userId: schema.postComments.userId,
        content: schema.postComments.content,
        createdAt: schema.postComments.createdAt,
        authorName: schema.users.displayName,
        authorAvatarUrl: schema.users.avatarUrl,
        authorUsername: schema.users.username,
      })
      .from(schema.postComments)
      .leftJoin(schema.users, eq(schema.postComments.userId, schema.users.id))
      .where(eq(schema.postComments.postId, postId))
      .orderBy(schema.postComments.createdAt);

    return { comments };
  }

  // ─── Internal: attach likedByMe to a set of posts ──────────────────────────────

  private async attachLikedByMe<T extends { id: string }>(
    posts: T[],
    userId: string,
  ): Promise<(T & { likedByMe: boolean })[]> {
    if (posts.length === 0) return [];

    const postIds = posts.map((p) => p.id);
    const likes = await this.db
      .select({ postId: schema.postLikes.postId })
      .from(schema.postLikes)
      .where(
        and(
          inArray(schema.postLikes.postId, postIds),
          eq(schema.postLikes.userId, userId),
        ),
      );

    const likedSet = new Set(likes.map((l) => l.postId));
    return posts.map((p) => ({ ...p, likedByMe: likedSet.has(p.id) }));
  }
}
