import { Module, Global } from '@nestjs/common';
import { FcmService } from './fcm.service';

/** Global so the gateway + any module can inject FcmService directly. */
@Global()
@Module({
  providers: [FcmService],
  exports: [FcmService],
})
export class PushModule {}
