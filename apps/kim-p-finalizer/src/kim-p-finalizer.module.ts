import { Module } from '@nestjs/common';
import { KimPFinalizerController } from './kim-p-finalizer.controller';
import { KimPFinalizerService } from './kim-p-finalizer.service';

@Module({
  imports: [],
  controllers: [KimPFinalizerController],
  providers: [KimPFinalizerService],
})
export class KimPFinalizerModule {}
