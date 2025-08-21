// packages/kimp-core/src/exchange/exchange.module.ts
import { Module } from '@nestjs/common';
import { UpbitModule } from './upbit/upbit.module';
import { BinanceModule } from './binance/binance.module';
import { SimulationModule } from './simulation/simulation.module';
import { ExchangeService } from './exchange.service';

@Module({
  imports: [UpbitModule, BinanceModule, SimulationModule],
  providers: [ExchangeService],
  exports: [ExchangeService, UpbitModule, BinanceModule, SimulationModule],
})
export class ExchangeModule {}
