import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { StorageService } from './storage.service';

@Injectable()
export class MediaService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly storageService: StorageService,
  ) {}

  // ─── Media Upload ──────────────────────────────────────────────────────────────

  async uploadMedia(
    userId: string,
    coupleId: string,
    file: Express.Multer.File,
    data: {
      type?: string;
      albumId?: string;
      tags?: string[];
      isStreakPhoto?: boolean;
      caption?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.verifyCoupleAccess(userId, coupleId);

    // Determine media type from mimetype if not provided
    const mediaType = data.type || this.inferMediaType(file.mimetype);

    // Validate file size limits
    this.validateFileSize(file.size, mediaType);

    // Store the file
    const storageResult = await this.storageService.store(file, coupleId, mediaType);

    // Insert media record
    const [mediaRecord] = await this.db
      .insert(schema.media)
      .values({
        coupleId,
        uploaderId: userId,
        type: mediaType,
        filename: storageResult.filename,
        originalFilename: file.originalname,
        storageKey: storageResult.storageKey,
        storageBucket: storageResult.storageBucket,
        cdnUrl: storageResult.cdnUrl,
        mimeType: file.mimetype,
        fileSize: file.size,
        albumId: data.albumId || null,
        tags: data.tags || [],
        caption: data.caption || null,
        isStreakPhoto: data.isStreakPhoto || false,
        streakDate: data.isStreakPhoto ? new Date().toISOString().slice(0, 10) : null,
        metadata: data.metadata || null,
      })
      .returning();

    // Increment couple media count
    await this.db
      .update(schema.couples)
      .set({
        mediaCount: sql`${schema.couples.mediaCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.couples.id, coupleId));

    // If assigned to an album, increment album media count
    if (data.albumId) {
      await this.db
        .update(schema.mediaAlbums)
        .set({
          mediaCount: sql`${schema.mediaAlbums.mediaCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.mediaAlbums.id, data.albumId));
    }

    return mediaRecord;
  }

  // ─── Media Queries ─────────────────────────────────────────────────────────────

  async getMedia(
    userId: string,
    coupleId: string,
    options: {
      type?: string;
      albumId?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
      sortBy?: string;
      order?: 'asc' | 'desc';
      dateFrom?: string;
      dateTo?: string;
      isStreakPhoto?: boolean;
      isFavorite?: boolean;
    } = {},
  ) {
    await this.verifyCoupleAccess(userId, coupleId);

    const {
      limit = 50,
      offset = 0,
    } = options;

    // Build conditions
    const conditions = [
      eq(schema.media.coupleId, coupleId),
      eq(schema.media.isDeleted, false),
      eq(schema.media.isArchived, false),
    ];

    if (options.type) {
      conditions.push(eq(schema.media.type, options.type));
    }

    if (options.albumId) {
      conditions.push(eq(schema.media.albumId, options.albumId));
    }

    if (options.isStreakPhoto) {
      conditions.push(eq(schema.media.isStreakPhoto, true));
    }

    if (options.isFavorite) {
      conditions.push(eq(schema.media.isFavorite, true));
    }

    if (options.dateFrom) {
      conditions.push(
        sql`${schema.media.createdAt} >= ${new Date(options.dateFrom)}`,
      );
    }

    if (options.dateTo) {
      conditions.push(
        sql`${schema.media.createdAt} <= ${new Date(options.dateTo)}`,
      );
    }

    const mediaList = await this.db
      .select()
      .from(schema.media)
      .where(and(...conditions))
      .orderBy(desc(schema.media.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.media)
      .where(and(...conditions));

    return {
      items: mediaList,
      total: countResult?.count ?? 0,
      limit,
      offset,
    };
  }

  async getMediaById(userId: string, mediaId: string) {
    const [mediaRecord] = await this.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, mediaId))
      .limit(1);

    if (!mediaRecord) {
      throw new NotFoundException('Media not found');
    }

    await this.verifyCoupleAccess(userId, mediaRecord.coupleId);

    return mediaRecord;
  }

  async updateMedia(
    userId: string,
    mediaId: string,
    data: {
      tags?: string[];
      albumId?: string | null;
      caption?: string;
      isFavorite?: boolean;
    },
  ) {
    const [mediaRecord] = await this.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, mediaId))
      .limit(1);

    if (!mediaRecord) {
      throw new NotFoundException('Media not found');
    }

    await this.verifyCoupleAccess(userId, mediaRecord.coupleId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }
    if (data.caption !== undefined) {
      updateData.caption = data.caption;
    }
    if (data.isFavorite !== undefined) {
      updateData.isFavorite = data.isFavorite;
    }

    // Handle album change
    if (data.albumId !== undefined) {
      const oldAlbumId = mediaRecord.albumId;
      updateData.albumId = data.albumId;

      // Decrement old album count
      if (oldAlbumId) {
        await this.db
          .update(schema.mediaAlbums)
          .set({
            mediaCount: sql`GREATEST(${schema.mediaAlbums.mediaCount} - 1, 0)`,
            updatedAt: new Date(),
          })
          .where(eq(schema.mediaAlbums.id, oldAlbumId));
      }

      // Increment new album count
      if (data.albumId) {
        await this.db
          .update(schema.mediaAlbums)
          .set({
            mediaCount: sql`${schema.mediaAlbums.mediaCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.mediaAlbums.id, data.albumId));
      }
    }

    const [updated] = await this.db
      .update(schema.media)
      .set(updateData)
      .where(eq(schema.media.id, mediaId))
      .returning();

    return updated;
  }

  async deleteMedia(userId: string, mediaId: string) {
    const [mediaRecord] = await this.db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, mediaId))
      .limit(1);

    if (!mediaRecord) {
      throw new NotFoundException('Media not found');
    }

    await this.verifyCoupleAccess(userId, mediaRecord.coupleId);

    // Soft delete
    const [updated] = await this.db
      .update(schema.media)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.media.id, mediaId))
      .returning();

    // Decrement couple media count
    await this.db
      .update(schema.couples)
      .set({
        mediaCount: sql`GREATEST(${schema.couples.mediaCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.couples.id, mediaRecord.coupleId));

    // Decrement album count if in album
    if (mediaRecord.albumId) {
      await this.db
        .update(schema.mediaAlbums)
        .set({
          mediaCount: sql`GREATEST(${schema.mediaAlbums.mediaCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.mediaAlbums.id, mediaRecord.albumId));
    }

    return updated;
  }

  // ─── Albums ────────────────────────────────────────────────────────────────────

  async createAlbum(
    userId: string,
    coupleId: string,
    data: { name: string; description?: string; coverMediaId?: string },
  ) {
    await this.verifyCoupleAccess(userId, coupleId);

    const [album] = await this.db
      .insert(schema.mediaAlbums)
      .values({
        coupleId,
        createdBy: userId,
        name: data.name,
        description: data.description || null,
        coverMediaId: data.coverMediaId || null,
      })
      .returning();

    return album;
  }

  async getAlbums(userId: string, coupleId: string) {
    await this.verifyCoupleAccess(userId, coupleId);

    const albums = await this.db
      .select()
      .from(schema.mediaAlbums)
      .where(eq(schema.mediaAlbums.coupleId, coupleId))
      .orderBy(desc(schema.mediaAlbums.updatedAt));

    // For each album with a coverMediaId, fetch the cover media's cdnUrl
    const albumsWithCovers = await Promise.all(
      albums.map(async (album) => {
        let coverUrl: string | null = null;
        if (album.coverMediaId) {
          const [coverMedia] = await this.db
            .select({ cdnUrl: schema.media.cdnUrl })
            .from(schema.media)
            .where(eq(schema.media.id, album.coverMediaId))
            .limit(1);
          coverUrl = coverMedia?.cdnUrl ?? null;
        }
        return { ...album, coverUrl };
      }),
    );

    return albumsWithCovers;
  }

  async getAlbumById(userId: string, albumId: string) {
    const [album] = await this.db
      .select()
      .from(schema.mediaAlbums)
      .where(eq(schema.mediaAlbums.id, albumId))
      .limit(1);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    await this.verifyCoupleAccess(userId, album.coupleId);

    return album;
  }

  async updateAlbum(
    userId: string,
    albumId: string,
    data: { name?: string; description?: string; coverMediaId?: string },
  ) {
    const [album] = await this.db
      .select()
      .from(schema.mediaAlbums)
      .where(eq(schema.mediaAlbums.id, albumId))
      .limit(1);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    await this.verifyCoupleAccess(userId, album.coupleId);

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.coverMediaId !== undefined) updateData.coverMediaId = data.coverMediaId;

    const [updated] = await this.db
      .update(schema.mediaAlbums)
      .set(updateData)
      .where(eq(schema.mediaAlbums.id, albumId))
      .returning();

    return updated;
  }

  async deleteAlbum(userId: string, albumId: string) {
    const [album] = await this.db
      .select()
      .from(schema.mediaAlbums)
      .where(eq(schema.mediaAlbums.id, albumId))
      .limit(1);

    if (!album) {
      throw new NotFoundException('Album not found');
    }

    await this.verifyCoupleAccess(userId, album.coupleId);

    // Remove album reference from all media in this album (media stays, just unlinked)
    await this.db
      .update(schema.media)
      .set({ albumId: null, updatedAt: new Date() })
      .where(eq(schema.media.albumId, albumId));

    // Delete the album
    await this.db
      .delete(schema.mediaAlbums)
      .where(eq(schema.mediaAlbums.id, albumId));

    return { deleted: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────────

  private inferMediaType(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'photo';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'voice';
    return 'file';
  }

  private validateFileSize(size: number, type: string): void {
    const limits: Record<string, number> = {
      photo: 100 * 1024 * 1024, // 100MB
      video: 500 * 1024 * 1024, // 500MB
      voice: 50 * 1024 * 1024, // 50MB
      file: 100 * 1024 * 1024, // 100MB
    };

    const limit = limits[type] ?? limits.file!;
    if (size > limit) {
      throw new BadRequestException(
        `File too large. Maximum size for ${type}: ${Math.round(limit / (1024 * 1024))}MB`,
      );
    }
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
