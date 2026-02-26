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
import { DatesService } from './dates.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('dates')
@UseGuards(JwtAuthGuard)
export class DatesController {
  constructor(private readonly datesService: DatesService) {}

  @Post()
  async createDate(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      date: string;
      type: string;
      isRecurring?: boolean;
      recurringType?: string;
      reminderDaysBefore?: number[];
      reminderEnabled?: boolean;
    },
  ) {
    const date = await this.datesService.createDate(coupleId, userId, body);
    return { success: true, data: { date } };
  }

  @Get()
  async getDates(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const dates = await this.datesService.getDates(coupleId, userId);
    return { success: true, data: { dates } };
  }

  @Get(':id')
  async getDate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const date = await this.datesService.getDateById(id, coupleId, userId);
    return { success: true, data: { date } };
  }

  @Patch(':id')
  async updateDate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      date?: string;
      type?: string;
      isRecurring?: boolean;
      recurringType?: string;
      reminderDaysBefore?: number[];
      reminderEnabled?: boolean;
    },
  ) {
    const date = await this.datesService.updateDate(
      id,
      coupleId,
      userId,
      body,
    );
    return { success: true, data: { date } };
  }

  @Delete(':id')
  async deleteDate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    await this.datesService.deleteDate(id, coupleId, userId);
    return { success: true };
  }

  @Post(':id/celebrate')
  async celebrateDate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      year: number;
      activities?: string[];
      photos?: string[];
      notes?: string;
    },
  ) {
    const celebration = await this.datesService.celebrateDate(
      id,
      coupleId,
      userId,
      body,
    );
    return { success: true, data: { celebration } };
  }

  @Get(':id/celebrations')
  async getCelebrations(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const celebrations = await this.datesService.getCelebrations(
      id,
      coupleId,
      userId,
    );
    return { success: true, data: { celebrations } };
  }
}
