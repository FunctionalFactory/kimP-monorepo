import { Module } from '@nestjs/common';
import { KimpCoreService } from './kimp-core.service';
import { DatabaseModule } from './db/database.module';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [DatabaseModule, AppConfigModule],
  providers: [KimpCoreService],
  exports: [KimpCoreService, DatabaseModule, AppConfigModule],
})
export class KimpCoreModule {}
