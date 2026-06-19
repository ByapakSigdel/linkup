import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly storageService: StorageService,
  ) {}

  // ─── Upload ────────────────────────────────────────────────────────────────────

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max (video limit)
    }),
  )
  async uploadMedia(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      coupleId: string;
      type?: string;
      albumId?: string;
      tags?: string | string[];
      isStreakPhoto?: string;
      caption?: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!body.coupleId) {
      throw new BadRequestException('coupleId is required');
    }

    // Parse tags (may come as JSON string from form-data)
    let tags: string[] = [];
    if (body.tags) {
      if (typeof body.tags === 'string') {
        try {
          const parsed: unknown = JSON.parse(body.tags);
          tags = Array.isArray(parsed) ? (parsed as string[]) : [];
        } catch {
          tags = [body.tags];
        }
      } else {
        tags = body.tags;
      }
    }

    const media = await this.mediaService.uploadMedia(userId, body.coupleId, file, {
      type: body.type,
      albumId: body.albumId,
      tags,
      isStreakPhoto: body.isStreakPhoto === 'true',
      caption: body.caption,
    });

    return {
      success: true,
      data: { media },
    };
  }

  // ─── Media CRUD ────────────────────────────────────────────────────────────────

  @Get()
  async getMedia(
    @CurrentUser('id') userId: string,
    @Query('coupleId') coupleId: string,
    @Query('type') type?: string,
    @Query('albumId') albumId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('isStreakPhoto') isStreakPhoto?: string,
    @Query('isFavorite') isFavorite?: string,
  ) {
    if (!coupleId) {
      throw new BadRequestException('coupleId query parameter is required');
    }

    const result = await this.mediaService.getMedia(userId, coupleId, {
      type,
      albumId,
      limit,
      offset,
      sortBy,
      order,
      dateFrom,
      dateTo,
      isStreakPhoto: isStreakPhoto === 'true',
      isFavorite: isFavorite === 'true',
    });

    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  async getMediaById(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const media = await this.mediaService.getMediaById(userId, id);

    return {
      success: true,
      data: { media },
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateMedia(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body()
    body: {
      tags?: string[];
      albumId?: string | null;
      caption?: string;
      isFavorite?: boolean;
    },
  ) {
    const media = await this.mediaService.updateMedia(userId, id, body);

    return {
      success: true,
      data: { media },
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMedia(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.mediaService.deleteMedia(userId, id);

    return {
      success: true,
      data: { message: 'Media deleted' },
    };
  }

  // ─── Albums ────────────────────────────────────────────────────────────────────

  @Post('albums')
  async createAlbum(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      coupleId: string;
      name: string;
      description?: string;
      coverMediaId?: string;
    },
  ) {
    if (!body.coupleId || !body.name) {
      throw new BadRequestException('coupleId and name are required');
    }

    const album = await this.mediaService.createAlbum(userId, body.coupleId, {
      name: body.name,
      description: body.description,
      coverMediaId: body.coverMediaId,
    });

    return {
      success: true,
      data: { album },
    };
  }

  @Get('albums/list')
  async getAlbums(
    @CurrentUser('id') userId: string,
    @Query('coupleId') coupleId: string,
  ) {
    if (!coupleId) {
      throw new BadRequestException('coupleId query parameter is required');
    }

    const albums = await this.mediaService.getAlbums(userId, coupleId);

    return {
      success: true,
      data: { albums },
    };
  }

  @Get('albums/:id')
  async getAlbumById(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const album = await this.mediaService.getAlbumById(userId, id);

    return {
      success: true,
      data: { album },
    };
  }

  @Patch('albums/:id')
  @HttpCode(HttpStatus.OK)
  async updateAlbum(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      coverMediaId?: string;
    },
  ) {
    const album = await this.mediaService.updateAlbum(userId, id, body);

    return {
      success: true,
      data: { album },
    };
  }

  @Delete('albums/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAlbum(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.mediaService.deleteAlbum(userId, id);

    return {
      success: true,
      data: { message: 'Album deleted' },
    };
  }

  // ─── File Serving ──────────────────────────────────────────────────────────────

  /**
   * Serve uploaded files from local storage.
   * Route: GET /api/v1/media/files/:coupleId/:type/:filename
   *
   * This endpoint does NOT require auth — files are served by their
   * unique storage key which includes the coupleId, making them
   * effectively unguessable. For production, use signed URLs or S3.
   */
  @Public()
  @Get('files/:coupleId/:type/:filename')
  async serveFile(
    @Param('coupleId') coupleId: string,
    @Param('type') type: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const storageKey = `${coupleId}/${type}/${filename}`;
    const filePath = this.storageService.getAbsolutePath(storageKey);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Set content type based on extension
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.pdf': 'application/pdf',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
