// packages/kimp-core/src/db/database.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArbitrageCycle } from './entities/arbitrage-cycle.entity';
import { Trade } from './entities/trade.entity';
import { PortfolioLog } from './entities/portfolio-log.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { HistoricalPrice } from './entities/historical-price.entity';
import { ArbitrageRecordService } from './arbitrage-record.service';
import { PortfolioLogService } from './portfolio-log.service';
import { HistoricalPriceService } from './historical-price.service';
import { SettingsService } from '../utils/service/settings.service';

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
        entities: [
          ArbitrageCycle,
          Trade,
          PortfolioLog,
          SystemSetting,
          HistoricalPrice,
        ],
        synchronize: false,
        autoLoadEntities: true,
        logging: ['error', 'warn'],
        dropSchema: false,
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      ArbitrageCycle,
      Trade,
      PortfolioLog,
      SystemSetting,
      HistoricalPrice,
    ]),
  ],
  providers: [
    ArbitrageRecordService,
    PortfolioLogService,
    HistoricalPriceService,
    {
      provide: 'SYSTEM_SETTING_REPOSITORY',
      useFactory: (dataSource) => dataSource.getRepository(SystemSetting),
      inject: [getDataSourceToken()],
    },
    {
      provide: 'HISTORICAL_PRICE_REPOSITORY',
      useFactory: (dataSource) => dataSource.getRepository(HistoricalPrice),
      inject: [getDataSourceToken()],
    },
    SettingsService,
  ],
  exports: [
    ArbitrageRecordService,
    PortfolioLogService,
    HistoricalPriceService,
    SettingsService,
    TypeOrmModule, // Repository들을 export
    'SYSTEM_SETTING_REPOSITORY', // Repository provider export
    'HISTORICAL_PRICE_REPOSITORY', // Repository provider export
  ],
})
export class DatabaseModule implements OnModuleInit {
  constructor(private readonly settingsService: SettingsService) {}

  async onModuleInit() {
    // 기본 설정 데이터 초기화
    await this.initializeDefaultSettings();
  }

  private async initializeDefaultSettings() {
    try {
      const defaultSettings = [
        {
          key: 'INITIATOR_MIN_SPREAD',
          value: '0.5',
          description: 'Initiator에서 사용할 최소 스프레드 (%)',
        },
        {
          key: 'FINALIZER_MIN_PROFIT',
          value: '0.1',
          description: 'Finalizer에서 사용할 최소 수익률 (%)',
        },
      ];

      for (const setting of defaultSettings) {
        const existingSetting = await this.settingsService.getSetting(
          setting.key,
        );
        if (!existingSetting) {
          await this.settingsService.updateSetting(
            setting.key,
            setting.value,
            setting.description,
          );
        }
      }
    } catch (error) {
      console.error('기본 설정 초기화 오류:', error);
    }
  }
}
