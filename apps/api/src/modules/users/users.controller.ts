import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    const user = await this.usersService.findById(userId);
    return { success: true, data: { user } };
  }

  @Get('me/profile')
  async getMyProfile(@CurrentUser('id') userId: string) {
    const profile = await this.usersService.getProfileWithStats(userId);
    return { success: true, data: profile };
  }

  @Get('me/settings')
  async getSettings(@CurrentUser('id') userId: string) {
    const settings = await this.usersService.getSettings(userId);
    return { success: true, data: { settings } };
  }

  @Patch('me/settings')
  async updateSettings(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      themeId?: string;
      pushNotifications?: boolean;
      messageNotifications?: boolean;
      callNotifications?: boolean;
      streakReminders?: boolean;
      anniversaryReminders?: boolean;
      showOnlineStatus?: boolean;
      showReadReceipts?: boolean;
      showTypingIndicator?: boolean;
      autoDownloadMedia?: boolean;
      mediaQuality?: string;
      fontSize?: string;
      reduceMotion?: boolean;
      highContrast?: boolean;
    },
  ) {
    const settings = await this.usersService.updateSettings(userId, body);
    return { success: true, data: { settings } };
  }

  @Post('me/push-token')
  async registerPushToken(
    @CurrentUser('id') userId: string,
    @Body() body: { token?: string },
  ) {
    await this.usersService.updatePushToken(userId, body.token ?? null);
    return { success: true, data: { ok: true } };
  }

  @Get('search')
  async searchUsers(@Query('q') query: string, @Query('limit') limit?: string) {
    const users = await this.usersService.searchUsers(
      query,
      limit ? parseInt(limit, 10) : 10,
    );
    return { success: true, data: { users } };
  }

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);
    return { success: true, data: { user } };
  }

  @Patch('me')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      dateOfBirth?: string;
      gender?: string;
      phone?: string;
      themeId?: string;
      locale?: string;
      timezone?: string;
    },
  ) {
    const user = await this.usersService.updateProfile(userId, body);
    return { success: true, data: { user } };
  }
}
