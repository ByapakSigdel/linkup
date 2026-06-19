import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  async getAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('category') category?: string,
    @Query('unlocked') unlocked?: string,
  ) {
    const data = await this.achievementsService.getAll(coupleId, userId, {
      category,
      unlocked:
        unlocked === undefined ? undefined : unlocked === 'true',
    });
    return { success: true, data };
  }

  @Get('me')
  async getMine(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.achievementsService.getMine(coupleId, userId);
    return { success: true, data };
  }

  @Get('progress')
  async getProgress(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.achievementsService.getProgress(coupleId, userId);
    return { success: true, data };
  }

  @Post('sync')
  async sync(@CurrentUser('coupleId') coupleId: string) {
    const unlocked = await this.achievementsService.syncForCouple(coupleId);
    return { success: true, data: { unlocked } };
  }

  @Post(':id/showcase')
  async showcase(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.achievementsService.toggleShowcase(
      id,
      coupleId,
      userId,
    );
    return { success: true, data };
  }
}
