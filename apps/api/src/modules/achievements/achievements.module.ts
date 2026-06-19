import { Module, Global } from '@nestjs/common';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';

@Global()
@Module({
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
