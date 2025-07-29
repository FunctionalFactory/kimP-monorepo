import { Module } from '@nestjs/common';
import { CycleSchedulerService } from './cycle-scheduler.service';
import { FinalizerModule } from '../finalizer/finalizer.module';

@Module({
  imports: [FinalizerModule],
  providers: [CycleSchedulerService],
  exports: [CycleSchedulerService],
})
export class SchedulerModule {}
