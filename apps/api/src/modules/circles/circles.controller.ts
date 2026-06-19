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
import { CirclesService } from './circles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(private readonly circlesService: CirclesService) {}

  // 1. Create circle
  @Post()
  async createCircle(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      coverImageUrl?: string;
      isPrivate?: boolean;
      maxMembers?: number;
    },
  ) {
    const data = await this.circlesService.createCircle(userId, coupleId, body);
    return { success: true, data };
  }

  // 2. List circles
  @Get()
  async listCircles(
    @CurrentUser('coupleId') coupleId: string,
    @Query('type') type?: 'created' | 'joined' | 'all',
  ) {
    const data = await this.circlesService.listCircles(coupleId, type ?? 'all');
    return { success: true, data };
  }

  // 3. Circle details
  @Get(':id')
  async getCircleDetails(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.getCircleDetails(id, userId, coupleId);
    return { success: true, data };
  }

  // 4. Update circle (admin)
  @Patch(':id')
  async updateCircle(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      coverImageUrl?: string;
      isPrivate?: boolean;
    },
  ) {
    const data = await this.circlesService.updateCircle(id, coupleId, body);
    return { success: true, data };
  }

  // 5. Delete circle (creator)
  @Delete(':id')
  async deleteCircle(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.deleteCircle(id, coupleId);
    return { success: true, data };
  }

  // 6. Join circle
  @Post(':id/join')
  async joinCircle(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: { inviteCode?: string },
  ) {
    const data = await this.circlesService.joinCircle(
      id,
      userId,
      coupleId,
      body?.inviteCode,
    );
    return { success: true, data };
  }

  // 7. Leave circle
  @Delete(':id/leave')
  async leaveCircle(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.leaveCircle(id, coupleId);
    return { success: true, data };
  }

  // 8. Invite a couple (admin)
  @Post(':id/members')
  async inviteCouple(
    @Param('id') id: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: { coupleId: string; message?: string },
  ) {
    const data = await this.circlesService.inviteCouple(
      id,
      coupleId,
      body?.coupleId,
      body?.message,
    );
    return { success: true, data };
  }

  // 9. List posts (member)
  @Get(':id/posts')
  async listPosts(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const data = await this.circlesService.listPosts(
      id,
      userId,
      coupleId,
      limit ? parseInt(limit, 10) : 20,
      type,
    );
    return { success: true, data };
  }

  // 10. Create post (member)
  @Post(':id/posts')
  async createPost(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body()
    body: {
      content: string;
      mediaUrls?: string[];
      type?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const data = await this.circlesService.createPost(id, userId, coupleId, body);
    return { success: true, data };
  }

  // 11. Toggle like
  @Post(':circleId/posts/:postId/like')
  async toggleLike(
    @Param('circleId') circleId: string,
    @Param('postId') postId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.toggleLike(
      circleId,
      postId,
      userId,
      coupleId,
    );
    return { success: true, data };
  }

  // 12. Add comment
  @Post(':circleId/posts/:postId/comments')
  async addComment(
    @Param('circleId') circleId: string,
    @Param('postId') postId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: { content: string },
  ) {
    const data = await this.circlesService.addComment(
      circleId,
      postId,
      userId,
      coupleId,
      body?.content,
    );
    return { success: true, data };
  }

  // 13. List comments
  @Get(':circleId/posts/:postId/comments')
  async listComments(
    @Param('circleId') circleId: string,
    @Param('postId') postId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.listComments(circleId, postId, coupleId);
    return { success: true, data };
  }
}
