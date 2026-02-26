import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async sendMessage(
    senderId: string,
    coupleId: string,
    receiverId: string,
    data: {
      content: string;
      messageType?: string;
      mediaUrls?: string[];
      threadId?: string;
      isThreadStarter?: boolean;
    },
  ) {
    // Verify sender belongs to couple
    await this.verifyCoupleAccess(senderId, coupleId);

    const [message] = await this.db
      .insert(schema.messages)
      .values({
        coupleId,
        senderId,
        receiverId,
        content: data.content,
        messageType: data.messageType || 'text',
        mediaUrls: data.mediaUrls,
        threadId: data.threadId,
        isThreadStarter: data.isThreadStarter || false,
      })
      .returning();

    // Increment message count
    const [currentCouple] = await this.db
      .select({ count: schema.couples.messageCount })
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    await this.db
      .update(schema.couples)
      .set({
        messageCount: (currentCouple?.count ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.couples.id, coupleId));

    return message;
  }

  async getMessages(
    userId: string,
    coupleId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    await this.verifyCoupleAccess(userId, coupleId);

    const { limit = 50, offset = 0 } = options;

    const messageList = await this.db
      .select()
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.coupleId, coupleId),
          eq(schema.messages.isDeleted, false),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    return messageList;
  }

  async getMessageById(userId: string, messageId: string) {
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.verifyCoupleAccess(userId, message.coupleId);

    return message;
  }

  async markAsRead(userId: string, messageId: string) {
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.receiverId !== userId) {
      throw new ForbiddenException('Can only mark your own received messages as read');
    }

    const [updated] = await this.db
      .update(schema.messages)
      .set({
        status: 'read',
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.messages.id, messageId))
      .returning();

    return updated;
  }

  async deleteMessage(userId: string, messageId: string) {
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Can only delete your own messages');
    }

    const [updated] = await this.db
      .update(schema.messages)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.messages.id, messageId))
      .returning();

    return updated;
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('Can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    const [updated] = await this.db
      .update(schema.messages)
      .set({
        content,
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.messages.id, messageId))
      .returning();

    return updated;
  }

  async highlightMessage(
    userId: string,
    messageId: string,
    data: { category: string; color: string; note?: string },
  ) {
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.verifyCoupleAccess(userId, message.coupleId);

    const [updated] = await this.db
      .update(schema.messages)
      .set({
        isHighlighted: true,
        highlightCategory: data.category,
        highlightColor: data.color,
        highlightNote: data.note || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.messages.id, messageId))
      .returning();

    return updated;
  }

  async addReaction(userId: string, messageId: string, emoji: string) {
    const [message] = await this.db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .limit(1);

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    await this.verifyCoupleAccess(userId, message.coupleId);

    const [reaction] = await this.db
      .insert(schema.messageReactions)
      .values({
        messageId,
        userId,
        emoji,
      })
      .returning();

    return reaction;
  }

  async removeReaction(userId: string, reactionId: string) {
    const [reaction] = await this.db
      .select()
      .from(schema.messageReactions)
      .where(eq(schema.messageReactions.id, reactionId))
      .limit(1);

    if (!reaction) {
      throw new NotFoundException('Reaction not found');
    }

    if (reaction.userId !== userId) {
      throw new ForbiddenException('Can only remove your own reactions');
    }

    await this.db
      .delete(schema.messageReactions)
      .where(eq(schema.messageReactions.id, reactionId));
  }

  private async verifyCoupleAccess(userId: string, coupleId: string) {
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    if (couple.partner1Id !== userId && couple.partner2Id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return couple;
  }
}
