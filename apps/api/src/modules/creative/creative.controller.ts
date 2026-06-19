import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreativeService } from './creative.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('creative')
@UseGuards(JwtAuthGuard)
export class CreativeController {
  constructor(private readonly creativeService: CreativeService) {}

  // ─── Custom Emojis ───────────────────────────────────────────────────────────

  @Post('emojis')
  async createEmoji(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      name: string;
      image: string;
      category?: string;
      isAnimated?: boolean;
    },
  ) {
    const data = await this.creativeService.createEmoji(userId, coupleId, body);
    return { success: true, data };
  }

  @Get('emojis')
  async listEmojis(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.creativeService.listEmojis(coupleId);
    return { success: true, data };
  }

  @Post('emojis/:id/use')
  @HttpCode(HttpStatus.OK)
  async useEmoji(
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
  ) {
    const data = await this.creativeService.useEmoji(coupleId, id);
    return { success: true, data };
  }

  @Delete('emojis/:id')
  @HttpCode(HttpStatus.OK)
  async deleteEmoji(
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
  ) {
    const data = await this.creativeService.deleteEmoji(coupleId, id);
    return { success: true, data };
  }

  // ─── SoundBoard ────────────────────────────────────────────────────────────

  @Post('soundboard')
  async createSound(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      name: string;
      audio: string;
      emoji?: string;
      category?: string;
      color?: string;
      duration?: number;
    },
  ) {
    const data = await this.creativeService.createSound(userId, coupleId, body);
    return { success: true, data };
  }

  @Get('soundboard')
  async listSounds(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.creativeService.listSounds(coupleId);
    return { success: true, data };
  }

  @Post('soundboard/:id/play')
  @HttpCode(HttpStatus.OK)
  async playSound(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
  ) {
    const data = await this.creativeService.playSound(userId, coupleId, id);
    return { success: true, data };
  }

  @Delete('soundboard/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSound(
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
  ) {
    const data = await this.creativeService.deleteSound(coupleId, id);
    return { success: true, data };
  }

  // ─── Paintings (collaborative) ───────────────────────────────────────────────

  @Post('paintings')
  async createPainting(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      title?: string;
      width?: number;
      height?: number;
      backgroundColor?: string;
    },
  ) {
    const data = await this.creativeService.createPainting(
      userId,
      coupleId,
      body,
    );
    return { success: true, data };
  }

  @Get('paintings')
  async listPaintings(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.creativeService.listPaintings(coupleId);
    return { success: true, data };
  }

  @Get('paintings/:id')
  async getPainting(
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
  ) {
    const data = await this.creativeService.getPainting(coupleId, id);
    return { success: true, data };
  }

  @Patch('paintings/:id')
  @HttpCode(HttpStatus.OK)
  async updatePainting(
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
    @Body()
    body: {
      strokes?: unknown[];
      imageUrl?: string;
      thumbnailUrl?: string;
      title?: string;
      status?: string;
    },
  ) {
    const data = await this.creativeService.updatePainting(coupleId, id, body);
    return { success: true, data };
  }

  @Delete('paintings/:id')
  @HttpCode(HttpStatus.OK)
  async deletePainting(
    @CurrentUser('coupleId') coupleId: string,
    @Param('id') id: string,
  ) {
    const data = await this.creativeService.deletePainting(coupleId, id);
    return { success: true, data };
  }

  // ─── Scribbles ───────────────────────────────────────────────────────────────

  @Post('scribbles')
  async createScribble(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      image: string;
      strokes?: unknown[];
      backgroundColor?: string;
      sendAsMessage?: boolean;
    },
  ) {
    const data = await this.creativeService.createScribble(
      userId,
      coupleId,
      body,
    );
    return { success: true, data };
  }

  @Get('scribbles')
  async listScribbles(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.creativeService.listScribbles(coupleId);
    return { success: true, data };
  }
}
