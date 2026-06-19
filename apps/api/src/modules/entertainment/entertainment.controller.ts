import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EntertainmentService } from './entertainment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('entertainment')
@UseGuards(JwtAuthGuard)
export class EntertainmentController {
  constructor(private readonly entertainmentService: EntertainmentService) {}

  // ─── Watch Parties ──────────────────────────────────────────────────────────

  @Post('watch')
  async createWatchParty(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      source?: string;
      videoId?: string;
      videoUrl?: string;
      title?: string;
    },
  ) {
    const data = await this.entertainmentService.createWatchParty(
      coupleId,
      userId,
      body,
    );
    return { success: true, data };
  }

  @Get('watch/active')
  async getActiveWatchParty(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.entertainmentService.getActiveWatchParty(coupleId);
    return { success: true, data };
  }

  @Get('watch/history')
  async getWatchHistory(
    @CurrentUser('coupleId') coupleId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const data = await this.entertainmentService.getWatchHistory(
      coupleId,
      Number.isNaN(parsedLimit) ? 20 : parsedLimit,
    );
    return { success: true, data };
  }

  @Patch('watch/:id')
  async updateWatchParty(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      videoId?: string;
      videoUrl?: string;
      title?: string;
      status?: string;
    },
  ) {
    const data = await this.entertainmentService.updateWatchParty(
      id,
      coupleId,
      body,
    );
    return { success: true, data };
  }

  @Post('watch/:id/end')
  async endWatchParty(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.entertainmentService.endWatchParty(id, coupleId);
    return { success: true, data };
  }

  // ─── Call Sessions ──────────────────────────────────────────────────────────

  @Post('calls')
  async createCall(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: { type: 'voice' | 'video' | 'screen'; status?: string },
  ) {
    const data = await this.entertainmentService.createCall(
      coupleId,
      userId,
      body,
    );
    return { success: true, data };
  }

  @Get('calls/history')
  async getCallHistory(
    @CurrentUser('coupleId') coupleId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const data = await this.entertainmentService.getCallHistory(
      coupleId,
      Number.isNaN(parsedLimit) ? 20 : parsedLimit,
    );
    return { success: true, data };
  }

  @Patch('calls/:id')
  async updateCall(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: { status: string; durationSec?: number },
  ) {
    const data = await this.entertainmentService.updateCall(
      id,
      coupleId,
      userId,
      body,
    );
    return { success: true, data };
  }
}
