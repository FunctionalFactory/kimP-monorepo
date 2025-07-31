// packages/kimp-core/src/db/database.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArbitrageCycle } from './entities/arbitrage-cycle.entity';
import { Trade } from './entities/trade.entity';
import { PortfolioLog } from './entities/portfolio-log.entity';
import { ArbitrageRecordService } from './arbitrage-record.service';
import { PortfolioLogService } from './portfolio-log.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'kimp'),
        entities: [ArbitrageCycle, Trade, PortfolioLog],
        synchronize: false,
        autoLoadEntities: true,
        logging: ['error', 'warn'],
        dropSchema: false,
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([ArbitrageCycle, Trade, PortfolioLog]),
  ],
  providers: [ArbitrageRecordService, PortfolioLogService],
  exports: [
    ArbitrageRecordService,
    PortfolioLogService,
    TypeOrmModule, // Repository들을 export
  ],
})
export class DatabaseModule {}
