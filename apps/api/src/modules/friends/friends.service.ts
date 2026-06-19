import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { SQL } from 'drizzle-orm';
import {
  eq,
  and,
  or,
  desc,
  sql,
  inArray,
  notInArray,
  gt,
} from 'drizzle-orm';
import * as crypto from 'crypto';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_FRIENDS = 10;

type FriendPermissions = {
  viewPhotos: boolean;
  viewVideos: boolean;
  viewMessages: boolean;
  viewAchievements: boolean;
  commentOnPosts: boolean;
};

const DEFAULT_PERMISSIONS: FriendPermissions = {
  viewPhotos: true,
  viewVideos: false,
  viewMessages: false,
  viewAchievements: true,
  commentOnPosts: true,
};

@Injectable()
export class FriendsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
    private readonly notifications: NotificationsService,
  ) {}

  /** Throws if the user is not part of a couple. */
  private verifyCouple(coupleId: string | null | undefined): string {
    if (!coupleId) {
      throw new BadRequestException('You must be in a couple to use friends');
    }
    return coupleId;
  }

  private mergePermissions(
    partial?: Partial<FriendPermissions> | Record<string, boolean> | null,
  ): FriendPermissions {
    return { ...DEFAULT_PERMISSIONS, ...(partial ?? {}) };
  }

  /**
   * 1. GET /friends — list the couple's friends (both directions).
   */
  async listFriends(rawCoupleId: string) {
    const coupleId = this.verifyCouple(rawCoupleId);

    const rows = await this.db
      .select()
      .from(schema.friendships)
      .where(
        and(
          or(
            eq(schema.friendships.coupleId, coupleId),
            eq(schema.friendships.friendCoupleId, coupleId),
          ),
          eq(schema.friendships.status, 'active'),
        ),
      )
      .orderBy(desc(schema.friendships.createdAt));

    const friendUserIds = Array.from(
      new Set(rows.map((r) => r.friendUserId).filter((v): v is string => !!v)),
    );
    const friendCoupleIds = Array.from(
      new Set(
        rows.map((r) => r.friendCoupleId).filter((v): v is string => !!v),
      ),
    );

    type FriendUser = {
      id: string;
      displayName: string;
      username: string;
      avatarUrl: string | null;
      isOnline: boolean | null;
    };
    const userMap = new Map<string, FriendUser>();
    if (friendUserIds.length > 0) {
      const userRows: FriendUser[] = await this.db
        .select({
          id: schema.users.id,
          displayName: schema.users.displayName,
          username: schema.users.username,
          avatarUrl: schema.users.avatarUrl,
          isOnline: schema.users.isOnline,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, friendUserIds));
      for (const u of userRows) userMap.set(u.id, u);
    }

    type FriendCouple = {
      id: string;
      coupleName: string | null;
      coupleAvatarUrl: string | null;
    };
    const coupleMap = new Map<string, FriendCouple>();
    if (friendCoupleIds.length > 0) {
      const coupleRows: FriendCouple[] = await this.db
        .select({
          id: schema.couples.id,
          coupleName: schema.couples.coupleName,
          coupleAvatarUrl: schema.couples.coupleAvatarUrl,
        })
        .from(schema.couples)
        .where(inArray(schema.couples.id, friendCoupleIds));
      for (const c of coupleRows) coupleMap.set(c.id, c);
    }

    const friends = rows.map((r) => ({
      id: r.id,
      coupleId: r.coupleId,
      friendUserId: r.friendUserId,
      friendCoupleId: r.friendCoupleId,
      initiatedBy: r.initiatedBy,
      status: r.status,
      permissions: r.permissions,
      isOwner: r.coupleId === coupleId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      friendUser: r.friendUserId ? (userMap.get(r.friendUserId) ?? null) : null,
      friendCouple: r.friendCoupleId
        ? (coupleMap.get(r.friendCoupleId) ?? null)
        : null,
    }));

    return { friends, count: friends.length, maxAllowed: MAX_FRIENDS };
  }

  /**
   * Count distinct friendships involving the given couple (either side).
   */
  private async countFriends(coupleId: string): Promise<number> {
    const rows = await this.db
      .select({ id: schema.friendships.id })
      .from(schema.friendships)
      .where(
        and(
          or(
            eq(schema.friendships.coupleId, coupleId),
            eq(schema.friendships.friendCoupleId, coupleId),
          ),
          eq(schema.friendships.status, 'active'),
        ),
      );
    return rows.length;
  }

  /**
   * 2. POST /friends/invite — invite a user (by userId / username / email).
   */
  async invite(
    userId: string,
    rawCoupleId: string,
    body: {
      userId?: string;
      email?: string;
      username?: string;
      permissions?: Partial<FriendPermissions>;
    },
  ) {
    const coupleId = this.verifyCouple(rawCoupleId);

    // Enforce max friends
    const currentCount = await this.countFriends(coupleId);
    if (currentCount >= MAX_FRIENDS) {
      throw new BadRequestException(
        `You can have at most ${MAX_FRIENDS} friends`,
      );
    }

    // Resolve the target user (optional — invitations can be email-only)
    let targetUser:
      | {
          id: string;
          email: string;
          displayName: string;
          coupleId: string | null;
        }
      | undefined;

    if (body.userId || body.username || body.email) {
      const conditions: SQL[] = [];
      if (body.userId) conditions.push(eq(schema.users.id, body.userId));
      if (body.username)
        conditions.push(eq(schema.users.username, body.username));
      if (body.email) conditions.push(eq(schema.users.email, body.email));

      [targetUser] = await this.db
        .select({
          id: schema.users.id,
          email: schema.users.email,
          displayName: schema.users.displayName,
          coupleId: schema.users.coupleId,
        })
        .from(schema.users)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .limit(1);
    }

    if (!targetUser && !body.email) {
      throw new NotFoundException('Target user not found');
    }

    if (targetUser && targetUser.id === userId) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const toEmail = targetUser?.email ?? body.email ?? null;

    // Prevent duplicate pending invitations to the same target
    if (targetUser) {
      const [existing] = await this.db
        .select({ id: schema.friendInvitations.id })
        .from(schema.friendInvitations)
        .where(
          and(
            eq(schema.friendInvitations.fromCoupleId, coupleId),
            eq(schema.friendInvitations.toUserId, targetUser.id),
            eq(schema.friendInvitations.status, 'pending'),
          ),
        )
        .limit(1);
      if (existing) {
        throw new ConflictException(
          'A pending invitation to this user already exists',
        );
      }
    }

    const inviteCode = `friend_${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const permissions = this.mergePermissions(body.permissions);

    const [invitation] = await this.db
      .insert(schema.friendInvitations)
      .values({
        fromCoupleId: coupleId,
        fromUserId: userId,
        toUserId: targetUser?.id ?? null,
        toEmail,
        inviteCode,
        permissions,
        status: 'pending',
        expiresAt,
      })
      .returning();

    if (!invitation) {
      throw new Error('Failed to create invitation');
    }

    // Notify the target user if they exist in the system
    if (targetUser) {
      const [inviter] = await this.db
        .select({ displayName: schema.users.displayName })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      const inviterName = inviter?.displayName ?? 'Someone';

      await this.notifications.create({
        userId: targetUser.id,
        type: 'friend_invite',
        title: 'New friend request',
        body: `${inviterName}'s couple invited you to connect`,
        actionType: 'navigate',
        actionData: { route: '/friends', inviteId: invitation.id },
      });
    }

    return { invitation };
  }

  /**
   * 3. GET /friends/invites — pending invitations received + sent.
   */
  async listInvites(userId: string, rawCoupleId: string) {
    const coupleId = this.verifyCouple(rawCoupleId);
    const now = new Date();

    // Invitations addressed to the current user
    const received = await this.db
      .select()
      .from(schema.friendInvitations)
      .where(
        and(
          eq(schema.friendInvitations.toUserId, userId),
          eq(schema.friendInvitations.status, 'pending'),
          gt(schema.friendInvitations.expiresAt, now),
        ),
      )
      .orderBy(desc(schema.friendInvitations.createdAt));

    // Invitations sent by the current couple
    const sentRaw = await this.db
      .select()
      .from(schema.friendInvitations)
      .where(
        and(
          eq(schema.friendInvitations.fromCoupleId, coupleId),
          eq(schema.friendInvitations.status, 'pending'),
        ),
      )
      .orderBy(desc(schema.friendInvitations.createdAt));

    // Hydrate fromCouple + fromUser for received invitations
    const fromCoupleIds = Array.from(
      new Set(received.map((r) => r.fromCoupleId)),
    );
    const fromUserIds = Array.from(new Set(received.map((r) => r.fromUserId)));

    const fromCoupleMap = new Map<
      string,
      { id: string; coupleName: string | null; coupleAvatarUrl: string | null }
    >();
    if (fromCoupleIds.length > 0) {
      const couples = await this.db
        .select({
          id: schema.couples.id,
          coupleName: schema.couples.coupleName,
          coupleAvatarUrl: schema.couples.coupleAvatarUrl,
        })
        .from(schema.couples)
        .where(inArray(schema.couples.id, fromCoupleIds));
      for (const c of couples) fromCoupleMap.set(c.id, c);
    }

    const fromUserMap = new Map<
      string,
      {
        id: string;
        displayName: string;
        username: string;
        avatarUrl: string | null;
      }
    >();
    if (fromUserIds.length > 0) {
      const usrs = await this.db
        .select({
          id: schema.users.id,
          displayName: schema.users.displayName,
          username: schema.users.username,
          avatarUrl: schema.users.avatarUrl,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, fromUserIds));
      for (const u of usrs) fromUserMap.set(u.id, u);
    }

    const invitations = received.map((inv) => ({
      ...inv,
      fromCouple: fromCoupleMap.get(inv.fromCoupleId) ?? null,
      fromUser: fromUserMap.get(inv.fromUserId) ?? null,
    }));

    return { invitations, sent: sentRaw };
  }

  /**
   * 4. POST /friends/:id/accept — accept an invitation.
   */
  async accept(
    invitationId: string,
    userId: string,
    rawCoupleId: string | null,
    email: string,
  ) {
    const [invitation] = await this.db
      .select()
      .from(schema.friendInvitations)
      .where(eq(schema.friendInvitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is no longer pending');
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Verify the current user is the invitee
    const isInvitee =
      invitation.toUserId === userId ||
      (!!invitation.toEmail &&
        !!email &&
        invitation.toEmail.toLowerCase() === email.toLowerCase());
    if (!isInvitee) {
      throw new ForbiddenException('This invitation is not addressed to you');
    }

    // Mark invitation accepted
    await this.db
      .update(schema.friendInvitations)
      .set({
        status: 'accepted',
        acceptedBy: userId,
        acceptedAt: new Date(),
      })
      .where(eq(schema.friendInvitations.id, invitationId));

    // Create the friendship row owned by the inviter's couple
    const [friendship] = await this.db
      .insert(schema.friendships)
      .values({
        coupleId: invitation.fromCoupleId,
        friendUserId: userId,
        friendCoupleId: rawCoupleId ?? null,
        initiatedBy: invitation.fromUserId,
        status: 'active',
        permissions: this.mergePermissions(invitation.permissions),
      })
      .returning();

    if (!friendship) {
      throw new Error('Failed to create friendship');
    }

    // Notify the inviter
    const [accepter] = await this.db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const accepterName = accepter?.displayName ?? 'Someone';

    await this.notifications.create({
      userId: invitation.fromUserId,
      coupleId: invitation.fromCoupleId,
      type: 'friend_accepted',
      title: 'Friend request accepted',
      body: `${accepterName} accepted your friend request`,
      actionType: 'navigate',
      actionData: { route: '/friends', friendshipId: friendship.id },
    });

    // Realtime push to the inviter
    this.gateway.emitToUser(invitation.fromUserId, 'friend:accepted', {
      friendship,
    });

    return { friendship };
  }

  /**
   * 5. POST /friends/:id/decline — decline an invitation.
   */
  async decline(invitationId: string, userId: string, email: string) {
    const [invitation] = await this.db
      .select()
      .from(schema.friendInvitations)
      .where(eq(schema.friendInvitations.id, invitationId))
      .limit(1);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Invitation is no longer pending');
    }

    const isInvitee =
      invitation.toUserId === userId ||
      (!!invitation.toEmail &&
        !!email &&
        invitation.toEmail.toLowerCase() === email.toLowerCase());
    if (!isInvitee) {
      throw new ForbiddenException('This invitation is not addressed to you');
    }

    await this.db
      .update(schema.friendInvitations)
      .set({ status: 'declined' })
      .where(eq(schema.friendInvitations.id, invitationId));

    return { success: true };
  }

  /**
   * 6. PATCH /friends/:id — update permissions (owner couple only).
   */
  async updateFriendship(
    friendshipId: string,
    rawCoupleId: string,
    permissions?: Partial<FriendPermissions>,
  ) {
    const coupleId = this.verifyCouple(rawCoupleId);

    const [friendship] = await this.db
      .select()
      .from(schema.friendships)
      .where(eq(schema.friendships.id, friendshipId))
      .limit(1);

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    if (friendship.coupleId !== coupleId) {
      throw new ForbiddenException(
        'Only the owning couple may update this friendship',
      );
    }

    const mergedPermissions = {
      ...this.mergePermissions(friendship.permissions),
      ...(permissions ?? {}),
    };

    const [updated] = await this.db
      .update(schema.friendships)
      .set({ permissions: mergedPermissions, updatedAt: new Date() })
      .where(eq(schema.friendships.id, friendshipId))
      .returning();

    return { friend: updated };
  }

  /**
   * 7. DELETE /friends/:id — remove a friendship (either side may delete).
   */
  async removeFriendship(friendshipId: string, rawCoupleId: string) {
    const coupleId = this.verifyCouple(rawCoupleId);

    const [friendship] = await this.db
      .select()
      .from(schema.friendships)
      .where(eq(schema.friendships.id, friendshipId))
      .limit(1);

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    if (
      friendship.coupleId !== coupleId &&
      friendship.friendCoupleId !== coupleId
    ) {
      throw new ForbiddenException('You are not part of this friendship');
    }

    await this.db
      .delete(schema.friendships)
      .where(eq(schema.friendships.id, friendshipId));

    return { success: true };
  }

  /**
   * 8. GET /friends/discover — search users not already friends.
   */
  async discover(userId: string, rawCoupleId: string, q?: string) {
    const coupleId = this.verifyCouple(rawCoupleId);

    if (!q || q.trim().length === 0) {
      return { users: [] };
    }
    const term = `%${q.trim()}%`;

    // Exclude self and partner
    const excludeUserIds = new Set<string>([userId]);
    const partnerId = await this.gateway.resolvePartnerId(userId);
    if (partnerId) excludeUserIds.add(partnerId);

    // Exclude users already in an active friendship with this couple
    const existing = await this.db
      .select({
        friendUserId: schema.friendships.friendUserId,
        friendCoupleId: schema.friendships.friendCoupleId,
        ownerCoupleId: schema.friendships.coupleId,
      })
      .from(schema.friendships)
      .where(
        and(
          or(
            eq(schema.friendships.coupleId, coupleId),
            eq(schema.friendships.friendCoupleId, coupleId),
          ),
          eq(schema.friendships.status, 'active'),
        ),
      );

    const existingFriendCoupleIds = new Set<string>();
    for (const e of existing) {
      if (e.friendUserId) excludeUserIds.add(e.friendUserId);
      // The couple on the "other" side of the friendship
      if (e.ownerCoupleId === coupleId && e.friendCoupleId) {
        existingFriendCoupleIds.add(e.friendCoupleId);
      }
      if (e.friendCoupleId === coupleId) {
        existingFriendCoupleIds.add(e.ownerCoupleId);
      }
    }

    // Map already-befriended couples back to their member users to exclude them too
    if (existingFriendCoupleIds.size > 0) {
      const members = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(
          inArray(schema.users.coupleId, Array.from(existingFriendCoupleIds)),
        );
      for (const m of members) excludeUserIds.add(m.id);
    }

    const rows = await this.db
      .select({
        id: schema.users.id,
        displayName: schema.users.displayName,
        username: schema.users.username,
        avatarUrl: schema.users.avatarUrl,
        isOnline: schema.users.isOnline,
      })
      .from(schema.users)
      .where(
        and(
          or(
            sql`${schema.users.username} ILIKE ${term}`,
            sql`${schema.users.displayName} ILIKE ${term}`,
          ),
          notInArray(schema.users.id, Array.from(excludeUserIds)),
          eq(schema.users.isActive, true),
        ),
      )
      .limit(20);

    return { users: rows };
  }
}
