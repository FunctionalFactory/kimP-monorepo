import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { KimPFinalizerController } from './kim-p-finalizer.controller';
import { KimPFinalizerService } from './kim-p-finalizer.service';
import { CycleScheduler } from './scheduler/cycle.scheduler';
import { CycleFinderService } from './finalizer/cycle-finder.service';
import { KimpCoreModule } from '@app/kimp-core';

@Module({
  imports: [ScheduleModule.forRoot(), KimpCoreModule],
  controllers: [KimPFinalizerController],
  providers: [KimPFinalizerService, CycleScheduler, CycleFinderService],
})
export class KimPFinalizerModule {}
