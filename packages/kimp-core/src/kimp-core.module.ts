import { Module } from '@nestjs/common';
import { KimpCoreService } from './kimp-core.service';

@Module({
  providers: [KimpCoreService],
  exports: [KimpCoreService],
})
export class KimpCoreModule {}
