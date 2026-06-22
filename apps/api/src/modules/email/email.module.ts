import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';

/** Global so any module (AuthService, etc.) can inject EmailService directly. */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
