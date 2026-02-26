import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as jwt from 'jsonwebtoken';
import { TypingIndicator, PresenceUpdate } from '@linkup/types';
import { DRIZZLE } from '../database/database.module';
import * as schema from '../database/schema';

interface AuthenticatedSocket extends Socket {
  userId: string;
}

interface SendMessagePayload {
  coupleId: string;
  receiverId: string;
  content: string;
  messageType?: string;
  mediaUrls?: string[];
  threadId?: string;
  isThreadStarter?: boolean;
}

interface ReadMessagePayload {
  messageId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  /** Maps userId -> socketId for tracking online users */
  private readonly connectedUsers = new Map<string, string>();

  constructor(
    @Inject(DRIZZLE)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly configService: ConfigService,
  ) {}

  // ─── Connection Lifecycle ───────────────────────────────────────────────────

  async handleConnection(client: Socket): Promise<void> {
    try {
      const userId = await this.authenticateClient(client);
      (client as AuthenticatedSocket).userId = userId;
      this.connectedUsers.set(userId, client.id);

      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);

      // Mark user as online
      await this.db
        .update(schema.users)
        .set({ isOnline: true, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));

      // Notify partner of presence
      const presenceUpdate: PresenceUpdate = {
        userId,
        isOnline: true,
      };
      await this.emitToPartner(userId, 'presence:update', presenceUpdate);
    } catch (error) {
      this.logger.warn(
        `Authentication failed for client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client as AuthenticatedSocket).userId;
    if (!userId) return;

    this.connectedUsers.delete(userId);
    this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);

    // Mark user as offline
    const now = new Date();
    await this.db
      .update(schema.users)
      .set({
        isOnline: false,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(schema.users.id, userId));

    // Notify partner of presence change
    const presenceUpdate: PresenceUpdate = {
      userId,
      isOnline: false,
      lastSeenAt: now.toISOString(),
    };
    await this.emitToPartner(userId, 'presence:update', presenceUpdate);
  }

  // ─── Message Events ─────────────────────────────────────────────────────────

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const { userId } = client;
    const { coupleId, receiverId, content, messageType, mediaUrls, threadId, isThreadStarter } =
      payload;

    // Verify the sender belongs to the couple
    const couple = await this.verifyCoupleAccess(userId, coupleId);
    if (!couple) {
      return { error: 'Access denied' };
    }

    // Insert the message
    const [message] = await this.db
      .insert(schema.messages)
      .values({
        coupleId,
        senderId: userId,
        receiverId,
        content,
        messageType: messageType || 'text',
        mediaUrls: mediaUrls || null,
        threadId: threadId || null,
        isThreadStarter: isThreadStarter || false,
      })
      .returning();

    // Increment message count on the couple
    await this.db
      .update(schema.couples)
      .set({
        messageCount: (couple.messageCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.couples.id, coupleId));

    // Emit the new message to the receiver
    this.emitToUser(receiverId, 'message:new', message);

    // Confirm delivery back to sender
    return { event: 'message:sent', data: message };
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ReadMessagePayload,
  ) {
    const { userId } = client;
    const { messageId } = payload;

    // Fetch the message
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      return { error: 'Message not found' };
    }

    if (message.receiverId !== userId) {
      return { error: 'Can only mark your own received messages as read' };
    }

    // Update message status
    const now = new Date();
    const [updated] = await this.db
      .update(schema.messages)
      .set({
        status: 'read',
        readAt: now,
        updatedAt: now,
      })
      .where(eq(schema.messages.id, messageId))
      .returning();

    if (!updated) {
      return { error: 'Failed to update message' };
    }

    // Notify the original sender that their message was read
    this.emitToUser(message.senderId, 'message:read', {
      messageId: updated.id,
      readAt: updated.readAt?.toISOString(),
    });

    return { event: 'message:read:ack', data: { messageId: updated.id } };
  }

  // ─── Typing Indicators ─────────────────────────────────────────────────────

  @SubscribeMessage('message:edit')
  async handleMessageEdit(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string; content: string },
  ) {
    const { userId } = client;
    const { messageId, content } = payload;

    // Fetch the message
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      return { error: 'Message not found' };
    }

    if (message.senderId !== userId) {
      return { error: 'Can only edit your own messages' };
    }

    // Update message
    const now = new Date();
    const [updated] = await this.db
      .update(schema.messages)
      .set({
        content,
        isEdited: true,
        editedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.messages.id, messageId))
      .returning();

    if (!updated) {
      return { error: 'Failed to edit message' };
    }

    // Notify receiver
    this.emitToUser(message.receiverId, 'message:edited', updated);

    return { event: 'message:edited', data: updated };
  }

  @SubscribeMessage('message:delete')
  async handleMessageDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string },
  ) {
    const { userId } = client;
    const { messageId } = payload;

    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      return { error: 'Message not found' };
    }

    if (message.senderId !== userId) {
      return { error: 'Can only delete your own messages' };
    }

    const now = new Date();
    await this.db
      .update(schema.messages)
      .set({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.messages.id, messageId));

    // Notify receiver
    this.emitToUser(message.receiverId, 'message:deleted', { messageId });

    return { event: 'message:deleted', data: { messageId } };
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { coupleId: string },
  ) {
    const indicator: TypingIndicator = {
      coupleId: payload.coupleId,
      userId: client.userId,
      isTyping: true,
    };
    await this.emitToPartner(client.userId, 'typing:update', indicator);
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { coupleId: string },
  ) {
    const indicator: TypingIndicator = {
      coupleId: payload.coupleId,
      userId: client.userId,
      isTyping: false,
    };
    await this.emitToPartner(client.userId, 'typing:update', indicator);
  }

  // ─── Presence ───────────────────────────────────────────────────────────────

  @SubscribeMessage('reaction:add')
  async handleReactionAdd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { messageId: string; emoji: string },
  ) {
    const { userId } = client;
    const { messageId, emoji } = payload;

    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      return { error: 'Message not found' };
    }

    // Verify user belongs to the couple
    const couple = await this.verifyCoupleAccess(userId, message.coupleId);
    if (!couple) {
      return { error: 'Access denied' };
    }

    // Insert reaction
    const [reaction] = await this.db
      .insert(schema.messageReactions)
      .values({
        messageId,
        userId,
        emoji,
      })
      .returning();

    const reactionData = {
      messageId,
      reaction: {
        userId,
        emoji,
        timestamp: reaction!.createdAt?.toISOString() ?? new Date().toISOString(),
      },
    };

    // Notify the other user
    const receiverId =
      message.senderId === userId ? message.receiverId : message.senderId;
    this.emitToUser(receiverId, 'reaction:added', reactionData);

    return { event: 'reaction:added', data: reactionData };
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Return the partner's current presence status
    const partnerId = await this.getPartnerId(client.userId);
    if (!partnerId) {
      return { error: 'No partner found' };
    }

    const isOnline = this.connectedUsers.has(partnerId);

    let lastSeenAt: string | undefined;
    if (!isOnline) {
      const [partner] = await this.db
        .select({ lastSeenAt: schema.users.lastSeenAt })
        .from(schema.users)
        .where(eq(schema.users.id, partnerId))
        .limit(1);
      lastSeenAt = partner?.lastSeenAt?.toISOString();
    }

    const presenceUpdate: PresenceUpdate = {
      userId: partnerId,
      isOnline,
      lastSeenAt,
    };

    return { event: 'presence:status', data: presenceUpdate };
  }

  // ─── Helper Methods ─────────────────────────────────────────────────────────

  /**
   * Authenticate a connecting client by verifying the JWT token
   * from the handshake auth or authorization header.
   */
  private async authenticateClient(client: Socket): Promise<string> {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    const secret = this.configService.get<string>(
      'JWT_SECRET',
      'linkup-jwt-secret-change-in-production',
    );

    try {
      const decoded = jwt.verify(token, secret) as { sub: string; email: string };

      // Verify the user exists
      const [user] = await this.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.id, decoded.sub))
        .limit(1);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user.id;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  /**
   * Get the partner's userId for a given user by looking up the couple relationship.
   */
  private async getPartnerId(userId: string): Promise<string | null> {
    // Find the user's coupleId first
    const [user] = await this.db
      .select({ coupleId: schema.users.coupleId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user?.coupleId) return null;

    // Look up the couple to find the partner
    const [couple] = await this.db
      .select({
        partner1Id: schema.couples.partner1Id,
        partner2Id: schema.couples.partner2Id,
      })
      .from(schema.couples)
      .where(eq(schema.couples.id, user.coupleId))
      .limit(1);

    if (!couple) return null;

    return couple.partner1Id === userId
      ? couple.partner2Id
      : couple.partner1Id;
  }

  /**
   * Get the socket ID for a partner of the given user.
   */
  private async getPartnerSocketId(userId: string): Promise<string | null> {
    const partnerId = await this.getPartnerId(userId);
    if (!partnerId) return null;
    return this.connectedUsers.get(partnerId) ?? null;
  }

  /**
   * Emit an event to a specific user if they are online.
   * Public so other services (e.g. NotificationsService) can push real-time events.
   */
  emitToUser(userId: string, event: string, data: unknown): void {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /**
   * Emit an event to the partner of a given user.
   */
  private async emitToPartner(
    userId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    const socketId = await this.getPartnerSocketId(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /**
   * Verify that a user belongs to the specified couple. Returns the couple or null.
   */
  private async verifyCoupleAccess(userId: string, coupleId: string) {
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) return null;
    if (couple.partner1Id !== userId && couple.partner2Id !== userId) return null;

    return couple;
  }
}
