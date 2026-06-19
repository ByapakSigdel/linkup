import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/schema';
import { EventsGateway } from '../../gateway/events.gateway';

interface CreatePlaylistInput {
  name: string;
  description?: string;
  coverUrl?: string;
}

interface UpdatePlaylistInput {
  name?: string;
  description?: string;
  coverUrl?: string;
}

interface AddTrackInput {
  title: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  source?: 'youtube' | 'spotify' | 'url';
  sourceId?: string;
  url?: string;
  duration?: number;
}

interface ListenStateInput {
  trackId?: string;
  isPlaying: boolean;
  positionSec: number;
  track?: unknown;
}

@Injectable()
export class MusicService {
  constructor(
    @Inject(DRIZZLE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gateway: EventsGateway,
  ) {}

  private requireCouple(coupleId: string | null | undefined): string {
    if (!coupleId) {
      throw new BadRequestException('You must be in a couple');
    }
    return coupleId;
  }

  private async getOwnedPlaylist(playlistId: string, coupleId: string) {
    const [playlist] = await this.db
      .select()
      .from(schema.playlists)
      .where(
        and(
          eq(schema.playlists.id, playlistId),
          eq(schema.playlists.coupleId, coupleId),
        ),
      )
      .limit(1);

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return playlist;
  }

  async createPlaylist(
    coupleId: string | null,
    userId: string,
    data: CreatePlaylistInput,
  ) {
    const coupleIdValue = this.requireCouple(coupleId);

    const [playlist] = await this.db
      .insert(schema.playlists)
      .values({
        coupleId: coupleIdValue,
        createdBy: userId,
        name: data.name,
        description: data.description ?? null,
        coverUrl: data.coverUrl ?? null,
      })
      .returning();

    if (!playlist) {
      throw new BadRequestException('Failed to create playlist');
    }

    return playlist;
  }

  async getPlaylists(coupleId: string | null) {
    const coupleIdValue = this.requireCouple(coupleId);

    return this.db
      .select()
      .from(schema.playlists)
      .where(eq(schema.playlists.coupleId, coupleIdValue))
      .orderBy(desc(schema.playlists.createdAt));
  }

  async getPlaylist(playlistId: string, coupleId: string | null) {
    const coupleIdValue = this.requireCouple(coupleId);

    const playlist = await this.getOwnedPlaylist(playlistId, coupleIdValue);

    const tracks = await this.db
      .select()
      .from(schema.playlistTracks)
      .where(eq(schema.playlistTracks.playlistId, playlistId))
      .orderBy(
        asc(schema.playlistTracks.position),
        asc(schema.playlistTracks.createdAt),
      );

    return { playlist, tracks };
  }

  async updatePlaylist(
    playlistId: string,
    coupleId: string | null,
    data: UpdatePlaylistInput,
  ) {
    const coupleIdValue = this.requireCouple(coupleId);

    await this.getOwnedPlaylist(playlistId, coupleIdValue);

    const updates: Partial<typeof schema.playlists.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.coverUrl !== undefined) updates.coverUrl = data.coverUrl;

    const [playlist] = await this.db
      .update(schema.playlists)
      .set(updates)
      .where(eq(schema.playlists.id, playlistId))
      .returning();

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return playlist;
  }

  async deletePlaylist(playlistId: string, coupleId: string | null) {
    const coupleIdValue = this.requireCouple(coupleId);

    await this.getOwnedPlaylist(playlistId, coupleIdValue);

    await this.db
      .delete(schema.playlists)
      .where(eq(schema.playlists.id, playlistId));

    return { success: true as const };
  }

  async addTrack(
    playlistId: string,
    coupleId: string | null,
    userId: string,
    data: AddTrackInput,
  ) {
    const coupleIdValue = this.requireCouple(coupleId);

    const playlist = await this.getOwnedPlaylist(playlistId, coupleIdValue);

    const [maxRow] = await this.db
      .select({
        maxPosition: sql<number>`coalesce(max(${schema.playlistTracks.position}), 0)`,
      })
      .from(schema.playlistTracks)
      .where(eq(schema.playlistTracks.playlistId, playlistId));

    const nextPosition = (maxRow?.maxPosition ?? 0) + 1;

    const [track] = await this.db
      .insert(schema.playlistTracks)
      .values({
        playlistId,
        addedBy: userId,
        title: data.title,
        artist: data.artist ?? null,
        album: data.album ?? null,
        coverUrl: data.coverUrl ?? null,
        source: data.source ?? 'youtube',
        sourceId: data.sourceId ?? null,
        url: data.url ?? null,
        duration: data.duration ?? null,
        position: nextPosition,
      })
      .returning();

    if (!track) {
      throw new BadRequestException('Failed to add track');
    }

    await this.db
      .update(schema.playlists)
      .set({
        trackCount: (playlist.trackCount ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(schema.playlists.id, playlistId));

    return track;
  }

  async removeTrack(
    playlistId: string,
    trackId: string,
    coupleId: string | null,
  ) {
    const coupleIdValue = this.requireCouple(coupleId);

    const playlist = await this.getOwnedPlaylist(playlistId, coupleIdValue);

    const [track] = await this.db
      .select()
      .from(schema.playlistTracks)
      .where(
        and(
          eq(schema.playlistTracks.id, trackId),
          eq(schema.playlistTracks.playlistId, playlistId),
        ),
      )
      .limit(1);

    if (!track) {
      throw new NotFoundException('Track not found');
    }

    await this.db
      .delete(schema.playlistTracks)
      .where(eq(schema.playlistTracks.id, trackId));

    await this.db
      .update(schema.playlists)
      .set({
        trackCount: Math.max((playlist.trackCount ?? 0) - 1, 0),
        updatedAt: new Date(),
      })
      .where(eq(schema.playlists.id, playlistId));

    return { success: true as const };
  }

  async syncListenState(userId: string, body: ListenStateInput) {
    const partnerId = await this.gateway.resolvePartnerId(userId);

    if (partnerId) {
      this.gateway.emitToUser(partnerId, 'music:state', {
        userId,
        ...body,
      });
    }

    return { success: true as const };
  }
}
