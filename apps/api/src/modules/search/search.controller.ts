import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type SearchType =
  | 'messages'
  | 'media'
  | 'dates'
  | 'emojis'
  | 'playlists'
  | 'all';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async globalSearch(
    @CurrentUser('coupleId') coupleId: string,
    @Query('q') q?: string,
    @Query('type') type?: SearchType,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    const data = await this.searchService.globalSearch(
      coupleId,
      q,
      type ?? 'all',
      Number.isNaN(parsedLimit) ? 10 : parsedLimit,
    );
    return { success: true, data };
  }

  @Get('messages')
  async searchMessages(
    @CurrentUser('coupleId') coupleId: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const data = await this.searchService.searchMessages(
      coupleId,
      q,
      Number.isNaN(parsedLimit) ? 20 : parsedLimit,
      Number.isNaN(parsedOffset) ? 0 : parsedOffset,
    );
    return { success: true, data };
  }
}
