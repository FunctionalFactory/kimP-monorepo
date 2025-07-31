import { Module } from '@nestjs/common';
import { FinalizerService } from './finalizer.service';
import { KimpCoreModule } from '@app/kimp-core';

@Module({
  imports: [KimpCoreModule],
  providers: [FinalizerService],
  exports: [FinalizerService],
})
export class FinalizerModule {}
