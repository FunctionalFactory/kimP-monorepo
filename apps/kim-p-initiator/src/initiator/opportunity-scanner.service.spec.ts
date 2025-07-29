import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OpportunityScannerService } from './opportunity-scanner.service';
import { TradeExecutorService } from './trade-executor.service';
import { PriceUpdateData } from '../redis/redis-subscriber.service';

describe('OpportunityScannerService', () => {
  let service: OpportunityScannerService;
  let tradeExecutor: jest.Mocked<TradeExecutorService>;

  beforeEach(async () => {
    const mockTradeExecutor = {
      initiateArbitrageCycle: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunityScannerService,
        {
          provide: TradeExecutorService,
          useValue: mockTradeExecutor,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<OpportunityScannerService>(OpportunityScannerService);
    tradeExecutor = module.get(TradeExecutorService);

    // Logger를 mock으로 설정
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', () => {
      service.onModuleInit();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'OpportunityScannerService initialized. Listening for price updates...',
      );
    });
  });

  describe('handlePriceUpdate', () => {
    it('should store price updates', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);

      // Private property에 접근하여 확인
      const privateService = service as any;
      expect(privateService.lastPrices['xrp'].upbit).toBe(1000);
    });

    it('should detect normal opportunity when spread > 0.5%', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 994, // 0.6% 스프레드
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[기회감지] xrp 스프레드: 0.60%, Normal: true',
      );
      expect(tradeExecutor.initiateArbitrageCycle).toHaveBeenCalledWith({
        symbol: 'xrp',
        upbit: 1000,
        binance: 994,
        spread: {
          normalOpportunity: true,
          reverseOpportunity: false,
        },
      });
    });

    it('should detect reverse opportunity when spread > 0.5%', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 994, // 0.6% 스프레드
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 1000,
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[기회감지] xrp 스프레드: 0.60%, Normal: false',
      );
      expect(tradeExecutor.initiateArbitrageCycle).toHaveBeenCalledWith({
        symbol: 'xrp',
        upbit: 994,
        binance: 1000,
        spread: {
          normalOpportunity: false,
          reverseOpportunity: true,
        },
      });
    });

    it('should not trigger arbitrage when spread <= 0.5%', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 995, // 0.5% 스프레드
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(tradeExecutor.initiateArbitrageCycle).not.toHaveBeenCalled();
    });

    it('should handle multiple symbols independently', async () => {
      const xrpUpbit: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const xrpBinance: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 994,
        timestamp: Date.now(),
      };

      const trxUpbit: PriceUpdateData = {
        symbol: 'trx',
        exchange: 'upbit',
        price: 500,
        timestamp: Date.now(),
      };

      const trxBinance: PriceUpdateData = {
        symbol: 'trx',
        exchange: 'binance',
        price: 497,
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(xrpUpbit);
      await service.handlePriceUpdate(trxUpbit);
      await service.handlePriceUpdate(xrpBinance);
      await service.handlePriceUpdate(trxBinance);

      expect(tradeExecutor.initiateArbitrageCycle).toHaveBeenCalledTimes(2);

      const calls = tradeExecutor.initiateArbitrageCycle.mock.calls;
      expect(calls[0][0].symbol).toBe('xrp');
      expect(calls[1][0].symbol).toBe('trx');
    });

    it('should calculate spread correctly', async () => {
      const upbitData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'upbit',
        price: 1000,
        timestamp: Date.now(),
      };

      const binanceData: PriceUpdateData = {
        symbol: 'xrp',
        exchange: 'binance',
        price: 990, // 1% 스프레드
        timestamp: Date.now(),
      };

      await service.handlePriceUpdate(upbitData);
      await service.handlePriceUpdate(binanceData);

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        '[기회감지] xrp 스프레드: 1.00%, Normal: true',
      );
    });
  });
});
