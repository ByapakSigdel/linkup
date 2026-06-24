import { Module } from '@nestjs/common';
import { ConstellationController } from './constellation.controller';
import { ConstellationService } from './constellation.service';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [ConstellationController],
  providers: [ConstellationService],
})
export class ConstellationModule {}
