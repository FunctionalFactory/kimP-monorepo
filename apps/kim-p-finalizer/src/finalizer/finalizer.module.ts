import { Module } from '@nestjs/common';
import { FinalizerService } from './finalizer.service';

@Module({
  providers: [FinalizerService],
  exports: [FinalizerService],
})
export class FinalizerModule {}
