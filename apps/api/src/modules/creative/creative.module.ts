import { Module } from '@nestjs/common';
import { CreativeController } from './creative.controller';
import { CreativeService } from './creative.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [CreativeController],
  providers: [CreativeService],
  exports: [CreativeService],
})
export class CreativeModule {}
