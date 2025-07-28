import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WsModule } from './ws/ws.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ArbitrageCycle } from './db/entities/arbitrage-cycle.entity';
import { PortfolioLog } from './db/entities/portfolio-log.entity';
import { MarketDataModule } from './marketdata/marketdata.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';
import { NotificationModule } from './notification/notification.module';
import { UpbitModule } from './upbit/upbit.module';
import { BinanceModule } from './binance/binance.module';
import { SimulationModule } from './common/simulation.module';
import { AppController } from './app.controller'; // ⭐️ AppController import 확인
import { AppService } from './app.service'; // ⭐️ AppService import 확인
import { CommonModule } from './common/common.module';
import { SessionModule } from './session/session.module';
import { SessionFundValidation } from './db/entities/session-fund-validation.entity';
import { MonitoringService } from './monitoring/monitoring.service';
import { MonitoringModule } from './monitoring/monitoring.module';
import { TelegramWebhookController } from './monitoring/telegram-webhook/telegram-webhook.controller';
import { AppConfigModule } from './config/config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [ArbitrageCycle, PortfolioLog, SessionFundValidation],
      synchronize: true,
    }),
    WsModule,
    MarketDataModule,
    ArbitrageModule,
    NotificationModule,
    UpbitModule,
    BinanceModule,
    SimulationModule,
    SessionModule,
    CommonModule,
    SessionModule,
    MonitoringModule,
    AppConfigModule,
  ],
  controllers: [AppController, TelegramWebhookController], // ⭐️ AppController가 등록되어 있는지 확인
  providers: [AppService, MonitoringService], // ⭐️ AppService가 등록되어 있는지 확인
})
export class AppModule {}
