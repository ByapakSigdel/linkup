import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';

type SearchType = 'messages' | 'media' | 'dates' | 'emojis' | 'playlists' | 'all';

export interface GlobalSearchResults {
  messages: Array<{
    id: string;
    content: string;
    createdAt: Date | null;
    type: 'message';
  }>;
  media: Array<{
    id: string;
    caption: string | null;
    cdnUrl: string | null;
    mediaType: string;
    createdAt: Date | null;
    type: 'media';
  }>;
  dates: Array<{
    id: string;
    title: string;
    date: string;
    createdAt: Date | null;
    type: 'date';
  }>;
  emojis: Array<{
    id: string;
    name: string;
    imageUrl: string;
    type: 'emoji';
  }>;
  playlists: Array<{
    id: string;
    name: string;
    createdAt: Date | null;
    type: 'playlist';
  }>;
}

@Injectable()
export class SearchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  private requireCouple(coupleId: string | null | undefined): string {
    if (!coupleId) {
      throw new BadRequestException('You must be in a couple');
    }
    return coupleId;
  }

  private emptyResults(): GlobalSearchResults {
    return {
      messages: [],
      media: [],
      dates: [],
      emojis: [],
      playlists: [],
    };
  }

  async globalSearch(
    coupleId: string | null | undefined,
    rawQuery: string | undefined,
    type: SearchType = 'all',
    limit = 10,
  ) {
    const couple = this.requireCouple(coupleId);
    const q = (rawQuery ?? '').trim();

    if (q.length === 0) {
      const empty = this.emptyResults();
      return { results: empty, total: 0, query: q };
    }

    const like = `%${q}%`;
    const safeLimit = limit > 0 ? limit : 10;
    const results = this.emptyResults();

    const wantAll = type === 'all';

    if (wantAll || type === 'messages') {
      const rows = await this.db
        .select({
          id: schema.messages.id,
          content: schema.messages.content,
          createdAt: schema.messages.createdAt,
        })
        .from(schema.messages)
        .where(
          and(
            eq(schema.messages.coupleId, couple),
            eq(schema.messages.isDeleted, false),
            ilike(schema.messages.content, like),
          ),
        )
        .orderBy(desc(schema.messages.createdAt))
        .limit(safeLimit);

      results.messages = rows.map((row) => ({
        id: row.id,
        content: (row.content ?? '').slice(0, 200),
        createdAt: row.createdAt,
        type: 'message' as const,
      }));
    }

    if (wantAll || type === 'media') {
      const rows = await this.db
        .select({
          id: schema.media.id,
          caption: schema.media.caption,
          cdnUrl: schema.media.cdnUrl,
          mediaType: schema.media.type,
          createdAt: schema.media.createdAt,
        })
        .from(schema.media)
        .where(
          and(
            eq(schema.media.coupleId, couple),
            eq(schema.media.isDeleted, false),
            or(
              ilike(schema.media.caption, like),
              ilike(schema.media.filename, like),
            ),
          ),
        )
        .orderBy(desc(schema.media.createdAt))
        .limit(safeLimit);

      results.media = rows.map((row) => ({
        id: row.id,
        caption: row.caption,
        cdnUrl: row.cdnUrl,
        mediaType: row.mediaType,
        createdAt: row.createdAt,
        type: 'media' as const,
      }));
    }

    if (wantAll || type === 'dates') {
      const rows = await this.db
        .select({
          id: schema.importantDates.id,
          title: schema.importantDates.title,
          date: schema.importantDates.date,
          createdAt: schema.importantDates.createdAt,
        })
        .from(schema.importantDates)
        .where(
          and(
            eq(schema.importantDates.coupleId, couple),
            or(
              ilike(schema.importantDates.title, like),
              ilike(schema.importantDates.description, like),
            ),
          ),
        )
        .orderBy(desc(schema.importantDates.createdAt))
        .limit(safeLimit);

      results.dates = rows.map((row) => ({
        id: row.id,
        title: row.title,
        date: row.date,
        createdAt: row.createdAt,
        type: 'date' as const,
      }));
    }

    if (wantAll || type === 'emojis') {
      const rows = await this.db
        .select({
          id: schema.customEmojis.id,
          name: schema.customEmojis.name,
          imageUrl: schema.customEmojis.imageUrl,
        })
        .from(schema.customEmojis)
        .where(
          and(
            eq(schema.customEmojis.coupleId, couple),
            ilike(schema.customEmojis.name, like),
          ),
        )
        .orderBy(desc(schema.customEmojis.createdAt))
        .limit(safeLimit);

      results.emojis = rows.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrl: row.imageUrl,
        type: 'emoji' as const,
      }));
    }

    if (wantAll || type === 'playlists') {
      const rows = await this.db
        .select({
          id: schema.playlists.id,
          name: schema.playlists.name,
          createdAt: schema.playlists.createdAt,
        })
        .from(schema.playlists)
        .where(
          and(
            eq(schema.playlists.coupleId, couple),
            or(
              ilike(schema.playlists.name, like),
              ilike(schema.playlists.description, like),
            ),
          ),
        )
        .orderBy(desc(schema.playlists.createdAt))
        .limit(safeLimit);

      results.playlists = rows.map((row) => ({
        id: row.id,
        name: row.name,
        createdAt: row.createdAt,
        type: 'playlist' as const,
      }));
    }

    const total =
      results.messages.length +
      results.media.length +
      results.dates.length +
      results.emojis.length +
      results.playlists.length;

    return { results, total, query: q };
  }

  async searchMessages(
    coupleId: string | null | undefined,
    rawQuery: string | undefined,
    limit = 20,
    offset = 0,
  ) {
    const couple = this.requireCouple(coupleId);
    const q = (rawQuery ?? '').trim();

    if (q.length === 0) {
      return { messages: [], total: 0 };
    }

    const like = `%${q}%`;
    const safeLimit = limit > 0 ? limit : 20;
    const safeOffset = offset > 0 ? offset : 0;

    const where = and(
      eq(schema.messages.coupleId, couple),
      eq(schema.messages.isDeleted, false),
      ilike(schema.messages.content, like),
    );

    const messages = await this.db
      .select({
        id: schema.messages.id,
        senderId: schema.messages.senderId,
        content: schema.messages.content,
        messageType: schema.messages.messageType,
        isHighlighted: schema.messages.isHighlighted,
        highlightCategory: schema.messages.highlightCategory,
        createdAt: schema.messages.createdAt,
      })
      .from(schema.messages)
      .where(where)
      .orderBy(desc(schema.messages.createdAt))
      .limit(safeLimit)
      .offset(safeOffset);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messages)
      .where(where);

    return { messages, total: countRow?.count ?? 0 };
  }
}
