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
import { EventsGateway } from '../../gateway/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
  ) {}

  async create(data: {
    userId: string;
    coupleId?: string;
    type: string;
    priority?: string;
    title: string;
    body?: string;
    imageUrl?: string;
    iconUrl?: string;
    actionType?: string;
    actionData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    expiresAt?: Date;
  }) {
    const [notification] = await this.db
      .insert(schema.notifications)
      .values({
        userId: data.userId,
        coupleId: data.coupleId,
        type: data.type,
        priority: data.priority ?? 'normal',
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl,
        iconUrl: data.iconUrl,
        actionType: data.actionType,
        actionData: data.actionData,
        metadata: data.metadata,
        expiresAt: data.expiresAt,
      })
      .returning();

    // Push notification to user in real-time via WebSocket
    if (notification) {
      this.gateway.emitToUser(data.userId, 'notification:new', notification);
    }

    return notification;
  }

  async getNotifications(userId: string, limit = 20, offset = 0) {
    return this.db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getUnreadCount(userId: string) {
    const unread = await this.db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.status, 'unread'),
        ),
      );

    return unread.length;
  }

  async markAsRead(notificationId: string, userId: string) {
    const [notification] = await this.db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.id, notificationId))
      .limit(1);

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Not your notification');
    }

    const [updated] = await this.db
      .update(schema.notifications)
      .set({
        status: 'read',
        readAt: new Date(),
      })
      .where(eq(schema.notifications.id, notificationId))
      .returning();

    return updated;
  }

  async markAllAsRead(userId: string) {
    await this.db
      .update(schema.notifications)
      .set({
        status: 'read',
        readAt: new Date(),
      })
      .where(
        and(
          eq(schema.notifications.userId, userId),
          eq(schema.notifications.status, 'unread'),
        ),
      );

    return { success: true };
  }

  async getPreferences(userId: string) {
    const [settings] = await this.db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, userId))
      .limit(1);

    if (!settings) {
      // Create default settings
      const [newSettings] = await this.db
        .insert(schema.userSettings)
        .values({ userId })
        .returning();
      return newSettings;
    }

    return settings;
  }

  async updatePreferences(
    userId: string,
    data: {
      pushNotifications?: boolean;
      messageNotifications?: boolean;
      callNotifications?: boolean;
      streakReminders?: boolean;
      anniversaryReminders?: boolean;
      emailNotifications?: boolean;
      reactionNotifications?: boolean;
      achievementNotifications?: boolean;
      circleNotifications?: boolean;
      quietHoursEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    },
  ) {
    const settings = await this.getPreferences(userId);

    if (!settings) {
      throw new NotFoundException('Settings not found');
    }

    const [updated] = await this.db
      .update(schema.userSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.userSettings.userId, userId))
      .returning();

    return updated;
  }
}
