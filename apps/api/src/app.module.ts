import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CouplesModule } from './modules/couples/couples.module';
import { MessagesModule } from './modules/messages/messages.module';
import { MediaModule } from './modules/media/media.module';
import { StreaksModule } from './modules/streaks/streaks.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DatesModule } from './modules/dates/dates.module';
import { GatewayModule } from './gateway/gateway.module';
import { CirclesModule } from './modules/circles/circles.module';
import { CreativeModule } from './modules/creative/creative.module';
import { MusicModule } from './modules/music/music.module';
import { SearchModule } from './modules/search/search.module';
import { EntertainmentModule } from './modules/entertainment/entertainment.module';
import { AchievementsModule } from './modules/achievements/achievements.module';
import { EmailModule } from './modules/email/email.module';
import { PushModule } from './modules/push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    EmailModule,
    PushModule,
    DatabaseModule,
    GatewayModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    CouplesModule,
    MessagesModule,
    MediaModule,
    StreaksModule,
    DatesModule,
    CirclesModule,
    CreativeModule,
    MusicModule,
    SearchModule,
    EntertainmentModule,
    AchievementsModule,
  ],
})
export class AppModule {}
