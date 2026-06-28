import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Post,
  Delete,
  HttpCode,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { deleteAccountSchema } from '@linkup/validation';
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

  /**
   * Delete (tombstone) the caller's own account — the "Relationship Graveyard"
   * offboarding. Destructive, so the body must carry `confirm: true` AND the
   * account password, which the service re-verifies before anonymizing. Returns
   * 204 with no body; the client clears auth and routes to a goodbye screen.
   */
  @Delete('me')
  @HttpCode(204)
  async deleteMe(
    @CurrentUser('id') userId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const { password } = deleteAccountSchema.parse(body);
    await this.usersService.deleteAccount(userId, password);
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

  @Post('me/avatar')
  @UseInterceptors(
    // 25MB — generous enough for unedited phone/camera photos.
    FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Avatar must be an image');
    }
    const user = await this.usersService.updateAvatar(userId, file);
    return { success: true, data: { user } };
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
