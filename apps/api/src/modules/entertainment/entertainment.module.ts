import { Module } from '@nestjs/common';
import { EntertainmentController } from './entertainment.controller';
import { EntertainmentService } from './entertainment.service';

@Module({
  controllers: [EntertainmentController],
  providers: [EntertainmentService],
  exports: [EntertainmentService],
})
export class EntertainmentModule {}
