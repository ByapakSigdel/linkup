import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findById(id: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        coupleId: schema.users.coupleId,
        themeId: schema.users.themeId,
        locale: schema.users.locale,
        timezone: schema.users.timezone,
        isOnline: schema.users.isOnline,
        lastSeenAt: schema.users.lastSeenAt,
        isVerified: schema.users.isVerified,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    return user || null;
  }

  async findByUsername(username: string) {
    const [user] = await this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        isOnline: schema.users.isOnline,
        lastSeenAt: schema.users.lastSeenAt,
      })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      dateOfBirth?: string;
      gender?: string;
      phone?: string;
      themeId?: string;
      locale?: string;
      timezone?: string;
    },
  ) {
    const [updated] = await this.db
      .update(schema.users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatarUrl: schema.users.avatarUrl,
        bio: schema.users.bio,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        themeId: schema.users.themeId,
        locale: schema.users.locale,
        timezone: schema.users.timezone,
      });

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    await this.db
      .update(schema.users)
      .set({
        isOnline,
        lastSeenAt: isOnline ? undefined : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  }
}
