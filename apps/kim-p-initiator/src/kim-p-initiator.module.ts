import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KimPInitiatorController } from './kim-p-initiator.controller';
import { KimPInitiatorService } from './kim-p-initiator.service';
import { KimpCoreModule } from '@app/kimp-core';
import { TestInjectionService } from './initiator/test-injection/test-injection.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    KimpCoreModule,
  ],
  controllers: [KimPInitiatorController],
  providers: [KimPInitiatorService, TestInjectionService],
})
export class KimPInitiatorModule {}
