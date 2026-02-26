import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

@Module({
  imports: [
    MulterModule.register({
      storage: undefined, // Use memory storage (buffer available on file)
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaService, StorageService],
  exports: [MediaService, StorageService],
})
export class MediaModule {}
