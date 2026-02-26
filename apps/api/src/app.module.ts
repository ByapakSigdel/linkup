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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CouplesModule,
    MessagesModule,
    MediaModule,
    StreaksModule,
    NotificationsModule,
    DatesModule,
    GatewayModule,
  ],
})
export class AppModule {}
