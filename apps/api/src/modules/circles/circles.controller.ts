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
import {
  createCircleSchema,
  updateCircleSchema,
  createCirclePostSchema,
  addCommentSchema,
  createStorySchema,
  type CreateCircleInput,
  type UpdateCircleInput,
  type CreateCirclePostInput,
  type AddCommentInput,
  type CreateStoryInput,
} from '@linkup/validation';
import { CirclesService } from './circles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const toLimit = (v?: string): number | undefined =>
  v !== undefined && v !== '' ? parseInt(v, 10) : undefined;

@Controller('circles')
@UseGuards(JwtAuthGuard)
export class CirclesController {
  constructor(private readonly circlesService: CirclesService) {}

  // ─── Profile (opt-in) ──────────────────────────────────────────────────────────

  // POST /circles — opt-in create THIS couple's circle.
  @Post()
  async createCircle(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: CreateCircleInput,
  ) {
    const input = createCircleSchema.parse(body);
    const data = await this.circlesService.createCircle(userId, coupleId, input);
    return { success: true, data };
  }

  // GET /circles/me — my couple's circle + owner stats.
  @Get('me')
  async getMyProfile(@CurrentUser('coupleId') coupleId: string) {
    const data = await this.circlesService.getMyProfile(coupleId);
    return { success: true, data };
  }

  // PATCH /circles/me — edit own circle.
  @Patch('me')
  async updateMyCircle(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: UpdateCircleInput,
  ) {
    const input = updateCircleSchema.parse(body);
    const data = await this.circlesService.updateMyCircle(userId, coupleId, input);
    return { success: true, data };
  }

  // DELETE /circles/me — delete own circle.
  @Delete('me')
  async deleteMyCircle(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.deleteMyCircle(userId, coupleId);
    return { success: true, data };
  }

  // ─── Owner posts ─────────────────────────────────────────────────────────────

  // POST /circles/me/posts — create a post on OWN circle.
  @Post('me/posts')
  async createPost(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: CreateCirclePostInput,
  ) {
    const input = createCirclePostSchema.parse(body);
    const data = await this.circlesService.createPost(userId, coupleId, input);
    return { success: true, data };
  }

  // DELETE /circles/me/posts/:postId — delete own post.
  @Delete('me/posts/:postId')
  async deletePost(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Param('postId') postId: string,
  ) {
    const data = await this.circlesService.deletePost(userId, coupleId, postId);
    return { success: true, data };
  }

  // ─── Owner followers / following / requests ──────────────────────────────────

  // GET /circles/me/followers
  @Get('me/followers')
  async listFollowers(
    @CurrentUser('coupleId') coupleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.listFollowers(coupleId, cursor, toLimit(limit));
    return { success: true, data };
  }

  // GET /circles/me/following
  @Get('me/following')
  async listFollowing(
    @CurrentUser('coupleId') coupleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.listFollowing(coupleId, cursor, toLimit(limit));
    return { success: true, data };
  }

  // GET /circles/me/requests
  @Get('me/requests')
  async listRequests(
    @CurrentUser('coupleId') coupleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.listRequests(coupleId, cursor, toLimit(limit));
    return { success: true, data };
  }

  // POST /circles/me/requests/:followId/accept
  @Post('me/requests/:followId/accept')
  async acceptRequest(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Param('followId') followId: string,
  ) {
    const data = await this.circlesService.acceptRequest(userId, coupleId, followId);
    return { success: true, data };
  }

  // POST /circles/me/requests/:followId/decline
  @Post('me/requests/:followId/decline')
  async declineRequest(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Param('followId') followId: string,
  ) {
    const data = await this.circlesService.declineRequest(userId, coupleId, followId);
    return { success: true, data };
  }

  // ─── Owner stories ───────────────────────────────────────────────────────────

  // POST /circles/me/stories — add a story to MY circle.
  @Post('me/stories')
  async createStory(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: CreateStoryInput,
  ) {
    const input = createStorySchema.parse(body);
    const data = await this.circlesService.createStory(userId, coupleId, input);
    return { success: true, data };
  }

  // GET /circles/me/stories/:storyId/viewers — owner-only viewer list.
  @Get('me/stories/:storyId/viewers')
  async listStoryViewers(
    @CurrentUser('coupleId') coupleId: string,
    @Param('storyId') storyId: string,
  ) {
    const data = await this.circlesService.listStoryViewers(coupleId, storyId);
    return { success: true, data };
  }

  // DELETE /circles/me/stories/:storyId — owner deletes own story.
  @Delete('me/stories/:storyId')
  async deleteStory(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Param('storyId') storyId: string,
  ) {
    const data = await this.circlesService.deleteStory(userId, coupleId, storyId);
    return { success: true, data };
  }

  // ─── Feed / Discover / Story tray (static segments before :idOrHandle) ────────

  // GET /circles/feed — Instagram home feed.
  @Get('feed')
  async getFeed(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.getFeed(userId, coupleId, cursor, toLimit(limit));
    return { success: true, data };
  }

  // GET /circles/discover — find circles to follow.
  @Get('discover')
  async discover(
    @CurrentUser('coupleId') coupleId: string,
    @Query('q') q?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.discover(coupleId, q, cursor, toLimit(limit));
    return { success: true, data };
  }

  // GET /circles/stories — story tray.
  @Get('stories')
  async getStoryTray(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.getStoryTray(userId, coupleId);
    return { success: true, data };
  }

  // POST /circles/stories/:storyId/view — record a view.
  @Post('stories/:storyId/view')
  async viewStory(
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Param('storyId') storyId: string,
  ) {
    const data = await this.circlesService.viewStory(storyId, userId, coupleId);
    return { success: true, data };
  }

  // ─── Public profile by id OR handle + nested reads (catch-all LAST) ───────────

  // GET /circles/:idOrHandle — view a profile.
  @Get(':idOrHandle')
  async getProfile(
    @Param('idOrHandle') idOrHandle: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.getProfile(idOrHandle, coupleId);
    return { success: true, data };
  }

  // GET /circles/:id/posts — profile grid.
  @Get(':idOrHandle/posts')
  async listPosts(
    @Param('idOrHandle') idOrHandle: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.listPosts(
      idOrHandle,
      userId,
      coupleId,
      cursor,
      toLimit(limit),
    );
    return { success: true, data };
  }

  // POST /circles/:id/posts/:postId/like — toggle like.
  @Post(':idOrHandle/posts/:postId/like')
  async toggleLike(
    @Param('idOrHandle') idOrHandle: string,
    @Param('postId') postId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.toggleLike(idOrHandle, postId, userId, coupleId);
    return { success: true, data };
  }

  // GET /circles/:id/posts/:postId/comments — list comments.
  @Get(':idOrHandle/posts/:postId/comments')
  async listComments(
    @Param('idOrHandle') idOrHandle: string,
    @Param('postId') postId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.circlesService.listComments(
      idOrHandle,
      postId,
      coupleId,
      cursor,
      toLimit(limit),
    );
    return { success: true, data };
  }

  // POST /circles/:id/posts/:postId/comments — add a comment.
  @Post(':idOrHandle/posts/:postId/comments')
  async addComment(
    @Param('idOrHandle') idOrHandle: string,
    @Param('postId') postId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
    @Body() body: AddCommentInput,
  ) {
    const input = addCommentSchema.parse(body);
    const data = await this.circlesService.addComment(
      idOrHandle,
      postId,
      userId,
      coupleId,
      input.content,
    );
    return { success: true, data };
  }

  // DELETE /circles/:id/posts/:postId/comments/:commentId — delete a comment.
  @Delete(':idOrHandle/posts/:postId/comments/:commentId')
  async deleteComment(
    @Param('idOrHandle') idOrHandle: string,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.deleteComment(
      idOrHandle,
      postId,
      commentId,
      userId,
      coupleId,
    );
    return { success: true, data };
  }

  // POST /circles/:id/follow — follow a circle.
  @Post(':idOrHandle/follow')
  async follow(
    @Param('idOrHandle') idOrHandle: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.follow(idOrHandle, userId, coupleId);
    return { success: true, data };
  }

  // DELETE /circles/:id/follow — unfollow / cancel pending.
  @Delete(':idOrHandle/follow')
  async unfollow(
    @Param('idOrHandle') idOrHandle: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.unfollow(idOrHandle, coupleId);
    return { success: true, data };
  }

  // GET /circles/:id/stories — active stories for a circle.
  @Get(':idOrHandle/stories')
  async listStories(
    @Param('idOrHandle') idOrHandle: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('coupleId') coupleId: string,
  ) {
    const data = await this.circlesService.listStories(idOrHandle, userId, coupleId);
    return { success: true, data };
  }
}
