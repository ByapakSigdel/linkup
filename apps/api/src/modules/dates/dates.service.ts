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
export class DatesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createDate(
    coupleId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      date: string;
      type: string;
      isRecurring?: boolean;
      recurringType?: string;
      reminderDaysBefore?: number[];
      reminderEnabled?: boolean;
    },
  ) {
    await this.verifyCoupleAccess(coupleId, userId);

    const [importantDate] = await this.db
      .insert(schema.importantDates)
      .values({
        coupleId,
        createdBy: userId,
        title: data.title,
        description: data.description,
        date: data.date,
        type: data.type,
        isRecurring: data.isRecurring ?? false,
        recurringType: data.recurringType,
        reminderDaysBefore: data.reminderDaysBefore,
        reminderEnabled: data.reminderEnabled ?? true,
      })
      .returning();

    return importantDate;
  }

  async getDates(coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    return this.db
      .select()
      .from(schema.importantDates)
      .where(eq(schema.importantDates.coupleId, coupleId))
      .orderBy(schema.importantDates.date);
  }

  async getDateById(dateId: string, coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    const [date] = await this.db
      .select()
      .from(schema.importantDates)
      .where(
        and(
          eq(schema.importantDates.id, dateId),
          eq(schema.importantDates.coupleId, coupleId),
        ),
      )
      .limit(1);

    if (!date) {
      throw new NotFoundException('Date not found');
    }

    return date;
  }

  async updateDate(
    dateId: string,
    coupleId: string,
    userId: string,
    data: {
      title?: string;
      description?: string;
      date?: string;
      type?: string;
      isRecurring?: boolean;
      recurringType?: string;
      reminderDaysBefore?: number[];
      reminderEnabled?: boolean;
    },
  ) {
    await this.verifyCoupleAccess(coupleId, userId);

    const [existing] = await this.db
      .select()
      .from(schema.importantDates)
      .where(
        and(
          eq(schema.importantDates.id, dateId),
          eq(schema.importantDates.coupleId, coupleId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Date not found');
    }

    const [updated] = await this.db
      .update(schema.importantDates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.importantDates.id, dateId))
      .returning();

    return updated;
  }

  async deleteDate(dateId: string, coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    const [existing] = await this.db
      .select()
      .from(schema.importantDates)
      .where(
        and(
          eq(schema.importantDates.id, dateId),
          eq(schema.importantDates.coupleId, coupleId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Date not found');
    }

    await this.db
      .delete(schema.importantDates)
      .where(eq(schema.importantDates.id, dateId));

    return { success: true };
  }

  async celebrateDate(
    dateId: string,
    coupleId: string,
    userId: string,
    data: {
      year: number;
      activities?: string[];
      photos?: string[];
      notes?: string;
    },
  ) {
    await this.verifyCoupleAccess(coupleId, userId);

    const [date] = await this.db
      .select()
      .from(schema.importantDates)
      .where(
        and(
          eq(schema.importantDates.id, dateId),
          eq(schema.importantDates.coupleId, coupleId),
        ),
      )
      .limit(1);

    if (!date) {
      throw new NotFoundException('Date not found');
    }

    const [celebration] = await this.db
      .insert(schema.dateCelebrations)
      .values({
        dateId,
        year: data.year,
        activities: data.activities ?? [],
        photos: data.photos ?? [],
        notes: data.notes,
      })
      .returning();

    return celebration;
  }

  async getCelebrations(dateId: string, coupleId: string, userId: string) {
    await this.verifyCoupleAccess(coupleId, userId);

    return this.db
      .select()
      .from(schema.dateCelebrations)
      .where(eq(schema.dateCelebrations.dateId, dateId))
      .orderBy(desc(schema.dateCelebrations.year));
  }

  private async verifyCoupleAccess(coupleId: string, userId: string) {
    const [couple] = await this.db
      .select()
      .from(schema.couples)
      .where(eq(schema.couples.id, coupleId))
      .limit(1);

    if (!couple) {
      throw new NotFoundException('Couple not found');
    }

    if (couple.partner1Id !== userId && couple.partner2Id !== userId) {
      throw new ForbiddenException('Not a member of this couple');
    }

    return couple;
  }
}
