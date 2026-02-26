import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
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

    return {
      success: true,
      data: { user },
    };
  }

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    const user = await this.usersService.findByUsername(username);

    return {
      success: true,
      data: { user },
    };
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

    return {
      success: true,
      data: { user },
    };
  }
}
