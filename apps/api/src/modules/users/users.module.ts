import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [
    // StorageService (avatar files reuse the media storage backend).
    MediaModule,
    // In-memory multipart parsing for the avatar upload endpoint.
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
