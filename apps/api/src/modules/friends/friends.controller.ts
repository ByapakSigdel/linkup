import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

interface FriendPermissions {
  viewPhotos?: boolean;
  viewVideos?: boolean;
  viewMessages?: boolean;
  viewAchievements?: boolean;
  commentOnPosts?: boolean;
}

interface InviteBody {
  userId?: string;
  email?: string;
  username?: string;
  permissions?: FriendPermissions;
}

interface UpdateFriendBody {
  permissions?: FriendPermissions;
}

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  async list(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.friendsService.listFriends(coupleId);
    return { success: true, data };
  }

  @Post('invite')
  async invite(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: InviteBody,
  ) {
    const data = await this.friendsService.invite(userId, coupleId, body);
    return { success: true, data };
  }

  @Get('invites')
  async invites(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.friendsService.listInvites(userId, coupleId);
    return { success: true, data };
  }

  @Get('discover')
  async discover(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('q') q?: string,
  ) {
    const data = await this.friendsService.discover(userId, coupleId, q);
    return { success: true, data };
  }

  @Post(':id/accept')
  async accept(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @CurrentUser('email') email: string,
  ) {
    const data = await this.friendsService.accept(id, userId, coupleId, email);
    return { success: true, data };
  }

  @Post(':id/decline')
  async decline(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') email: string,
  ) {
    const data = await this.friendsService.decline(id, userId, email);
    return { success: true, data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: UpdateFriendBody,
  ) {
    const data = await this.friendsService.updateFriendship(
      id,
      coupleId,
      body.permissions,
    );
    return { success: true, data };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.friendsService.removeFriendship(id, coupleId);
    return { success: true, data };
  }
}
