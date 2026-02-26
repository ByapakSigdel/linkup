import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CouplesService } from './couples.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('couples')
@UseGuards(JwtAuthGuard)
export class CouplesController {
  constructor(private readonly couplesService: CouplesService) {}

  @Post()
  async createCouple(@CurrentUser('id') userId: string) {
    const couple = await this.couplesService.createCouple(userId);

    return {
      success: true,
      data: { couple },
    };
  }

  @Post('join')
  async joinCouple(
    @CurrentUser('id') userId: string,
    @Body() body: { pairingCode: string },
  ) {
    const couple = await this.couplesService.joinCouple(userId, body.pairingCode);

    return {
      success: true,
      data: { couple },
    };
  }

  @Get(':id')
  async getCouple(@Param('id') id: string) {
    const couple = await this.couplesService.getCoupleById(id);

    return {
      success: true,
      data: { couple },
    };
  }

  @Patch(':id')
  async updateCouple(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      coupleName?: string;
      coupleAvatarUrl?: string;
      anniversaryDate?: string;
      relationshipStatus?: string;
      sharedThemeId?: string;
    },
  ) {
    const couple = await this.couplesService.updateCouple(id, userId, body);

    return {
      success: true,
      data: { couple },
    };
  }
}
