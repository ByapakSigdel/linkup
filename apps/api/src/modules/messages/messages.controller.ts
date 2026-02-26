import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      coupleId: string;
      receiverId: string;
      content: string;
      messageType?: string;
      mediaUrls?: string[];
      threadId?: string;
      isThreadStarter?: boolean;
    },
  ) {
    const message = await this.messagesService.sendMessage(
      userId,
      body.coupleId,
      body.receiverId,
      {
        content: body.content,
        messageType: body.messageType,
        mediaUrls: body.mediaUrls,
        threadId: body.threadId,
        isThreadStarter: body.isThreadStarter,
      },
    );

    return {
      success: true,
      data: { message },
    };
  }

  @Get('couple/:coupleId')
  async getMessages(
    @CurrentUser('id') userId: string,
    @Param('coupleId') coupleId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const messages = await this.messagesService.getMessages(userId, coupleId, {
      limit,
      offset,
    });

    return {
      success: true,
      data: { messages },
    };
  }

  @Get(':id')
  async getMessage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const message = await this.messagesService.getMessageById(userId, id);

    return {
      success: true,
      data: { message },
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const message = await this.messagesService.markAsRead(userId, id);

    return {
      success: true,
      data: { message },
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    await this.messagesService.deleteMessage(userId, id);

    return {
      success: true,
      data: { message: 'Message deleted' },
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async editMessage(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    const message = await this.messagesService.editMessage(userId, id, body.content);

    return {
      success: true,
      data: { message },
    };
  }

  @Post(':id/highlight')
  async highlightMessage(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body() body: { category: string; color: string; note?: string },
  ) {
    const message = await this.messagesService.highlightMessage(userId, messageId, body);

    return {
      success: true,
      data: { message },
    };
  }

  @Post(':id/reactions')
  async addReaction(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body() body: { emoji: string },
  ) {
    const reaction = await this.messagesService.addReaction(userId, messageId, body.emoji);

    return {
      success: true,
      data: { reaction },
    };
  }

  @Delete('reactions/:reactionId')
  @HttpCode(HttpStatus.OK)
  async removeReaction(
    @CurrentUser('id') userId: string,
    @Param('reactionId') reactionId: string,
  ) {
    await this.messagesService.removeReaction(userId, reactionId);

    return {
      success: true,
      data: { message: 'Reaction removed' },
    };
  }
}
