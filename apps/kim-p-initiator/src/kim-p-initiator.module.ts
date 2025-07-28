import { Module } from '@nestjs/common';
import { KimPInitiatorController } from './kim-p-initiator.controller';
import { KimPInitiatorService } from './kim-p-initiator.service';

@Module({
  imports: [],
  controllers: [KimPInitiatorController],
  providers: [KimPInitiatorService],
})
export class KimPInitiatorModule {}
