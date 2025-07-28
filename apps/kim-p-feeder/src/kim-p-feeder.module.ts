import { Module } from '@nestjs/common';
import { KimPFeederController } from './kim-p-feeder.controller';
import { KimPFeederService } from './kim-p-feeder.service';

@Module({
  imports: [],
  controllers: [KimPFeederController],
  providers: [KimPFeederService],
})
export class KimPFeederModule {}
