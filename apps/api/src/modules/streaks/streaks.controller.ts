import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StreaksService } from './streaks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('streaks')
@UseGuards(JwtAuthGuard)
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get()
  async getStreak(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const streak = await this.streaksService.getStreak(coupleId, userId);
    return { success: true, data: { streak } };
  }

  @Post('photo')
  async contributePhoto(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: { photoId: string },
  ) {
    const result = await this.streaksService.contributePhoto(
      coupleId,
      userId,
      body.photoId,
    );
    return { success: true, data: result };
  }

  @Post('freeze')
  async freezeStreak(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const streak = await this.streaksService.freezeStreak(coupleId, userId);
    return { success: true, data: { streak } };
  }

  @Post('recover')
  async recoverStreak(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const streak = await this.streaksService.recoverStreak(coupleId, userId);
    return { success: true, data: { streak } };
  }

  @Get('history')
  async getHistory(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const history = await this.streaksService.getHistory(
      coupleId,
      userId,
      limit ? parseInt(limit, 10) : 20,
      offset ? parseInt(offset, 10) : 0,
    );
    return { success: true, data: { history } };
  }

  @Get('leaderboard')
  async getLeaderboard(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const leaderboard = await this.streaksService.getLeaderboard(
      coupleId,
      userId,
    );
    return { success: true, data: { leaderboard } };
  }
}
