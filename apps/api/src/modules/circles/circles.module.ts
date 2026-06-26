import { Module } from '@nestjs/common';
import { CirclesController } from './circles.controller';
import { CirclesService } from './circles.service';
import { CircleDmService } from './circle-dm.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  controllers: [CirclesController],
  providers: [CirclesService, CircleDmService],
  exports: [CirclesService, CircleDmService],
})
export class CirclesModule {}
