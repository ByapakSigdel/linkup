import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { MusicService } from './music.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('music')
@UseGuards(JwtAuthGuard)
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  @Post('playlists')
  async createPlaylist(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      coverUrl?: string;
    },
  ) {
    const playlist = await this.musicService.createPlaylist(
      coupleId,
      userId,
      body,
    );
    return { success: true, data: { playlist } };
  }

  @Get('playlists')
  async getPlaylists(@CurrentUser('coupleId') coupleId: string) {
    const playlists = await this.musicService.getPlaylists(coupleId);
    return { success: true, data: { playlists } };
  }

  @Get('playlists/:id')
  async getPlaylist(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const { playlist, tracks } = await this.musicService.getPlaylist(
      id,
      coupleId,
    );
    return { success: true, data: { playlist, tracks } };
  }

  @Patch('playlists/:id')
  async updatePlaylist(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      coverUrl?: string;
    },
  ) {
    const playlist = await this.musicService.updatePlaylist(id, coupleId, body);
    return { success: true, data: { playlist } };
  }

  @Delete('playlists/:id')
  async deletePlaylist(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    await this.musicService.deletePlaylist(id, coupleId);
    return { success: true };
  }

  @Post('playlists/:id/tracks')
  async addTrack(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      title: string;
      artist?: string;
      album?: string;
      coverUrl?: string;
      source?: 'youtube' | 'spotify' | 'url';
      sourceId?: string;
      url?: string;
      duration?: number;
    },
  ) {
    const track = await this.musicService.addTrack(id, coupleId, userId, body);
    return { success: true, data: { track } };
  }

  @Delete('playlists/:playlistId/tracks/:trackId')
  async removeTrack(
    @Param('playlistId') playlistId: string,
    @Param('trackId') trackId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    await this.musicService.removeTrack(playlistId, trackId, coupleId);
    return { success: true };
  }

  @Post('listen/state')
  async syncListenState(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      trackId?: string;
      isPlaying: boolean;
      positionSec: number;
      track?: unknown;
    },
  ) {
    await this.musicService.syncListenState(userId, body);
    return { success: true };
  }
}
