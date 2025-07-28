import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeService, ExchangeType } from './exchange.service';
import {
  IExchange,
  OrderSide,
  OrderType,
  OrderStatus,
} from './exchange.interface';
import { UPBIT_EXCHANGE_SERVICE } from './upbit/upbit.module';
import { BINANCE_EXCHANGE_SERVICE } from './binance/binance.module';

describe('ExchangeService', () => {
  let service: ExchangeService;
  let mockUpbitService: jest.Mocked<IExchange>;
  let mockBinanceService: jest.Mocked<IExchange>;

  beforeEach(async () => {
    // Mock services
    mockUpbitService = {
      createOrder: jest.fn(),
      getOrder: jest.fn(),
      getBalances: jest.fn(),
      getOrderBook: jest.fn(),
      getWalletStatus: jest.fn(),
      getDepositAddress: jest.fn(),
      withdraw: jest.fn(),
      getWithdrawalChance: jest.fn(),
      getTickerInfo: jest.fn(),
      cancelOrder: jest.fn(),
      createFuturesOrder: jest.fn(),
      getFuturesBalances: jest.fn(),
      internalTransfer: jest.fn(),
      getDepositHistory: jest.fn(),
    };

    mockBinanceService = {
      createOrder: jest.fn(),
      getOrder: jest.fn(),
      getBalances: jest.fn(),
      getOrderBook: jest.fn(),
      getWalletStatus: jest.fn(),
      getDepositAddress: jest.fn(),
      withdraw: jest.fn(),
      getWithdrawalChance: jest.fn(),
      getTickerInfo: jest.fn(),
      cancelOrder: jest.fn(),
      createFuturesOrder: jest.fn(),
      getFuturesBalances: jest.fn(),
      internalTransfer: jest.fn(),
      getDepositHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeService,
        {
          provide: UPBIT_EXCHANGE_SERVICE,
          useValue: mockUpbitService,
        },
        {
          provide: BINANCE_EXCHANGE_SERVICE,
          useValue: mockBinanceService,
        },
      ],
    }).compile();

    service = module.get<ExchangeService>(ExchangeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalances', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockBalances = [
        { currency: 'BTC', balance: 1.0, locked: 0.0, available: 1.0 },
      ];
      mockUpbitService.getBalances.mockResolvedValue(mockBalances);

      const result = await service.getBalances('upbit');

      expect(mockUpbitService.getBalances).toHaveBeenCalledWith();
      expect(mockBinanceService.getBalances).not.toHaveBeenCalled();
      expect(result).toEqual(mockBalances);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockBalances = [
        { currency: 'BTC', balance: 1.0, locked: 0.0, available: 1.0 },
      ];
      mockBinanceService.getBalances.mockResolvedValue(mockBalances);

      const result = await service.getBalances('binance');

      expect(mockBinanceService.getBalances).toHaveBeenCalledWith();
      expect(mockUpbitService.getBalances).not.toHaveBeenCalled();
      expect(result).toEqual(mockBalances);
    });
  });

  describe('createOrder', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockOrder = {
        id: 'order-123',
        symbol: 'BTC-KRW',
        side: 'buy' as OrderSide,
        type: 'limit' as OrderType,
        amount: 0.001,
        price: 50000000,
        filledAmount: 0,
        status: 'open' as OrderStatus,
        timestamp: new Date(),
        fee: { currency: 'KRW', cost: 0 },
      };
      mockUpbitService.createOrder.mockResolvedValue(mockOrder);

      const result = await service.createOrder(
        'upbit',
        'BTC-KRW',
        'limit',
        'buy',
        0.001,
        50000000,
      );

      expect(mockUpbitService.createOrder).toHaveBeenCalledWith(
        'BTC-KRW',
        'limit',
        'buy',
        0.001,
        50000000,
      );
      expect(mockBinanceService.createOrder).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockOrder = {
        id: 'order-456',
        symbol: 'BTCUSDT',
        side: 'sell' as OrderSide,
        type: 'market' as OrderType,
        amount: 0.001,
        price: 50000,
        filledAmount: 0.001,
        status: 'filled' as OrderStatus,
        timestamp: new Date(),
        fee: { currency: 'USDT', cost: 0.05 },
      };
      mockBinanceService.createOrder.mockResolvedValue(mockOrder);

      const result = await service.createOrder(
        'binance',
        'BTCUSDT',
        'market',
        'sell',
        0.001,
      );

      expect(mockBinanceService.createOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        'market',
        'sell',
        0.001,
        undefined,
      );
      expect(mockUpbitService.createOrder).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });
  });

  describe('getOrderBook', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockOrderBook = {
        symbol: 'BTC-KRW',
        bids: [{ price: 50000000, amount: 1.0 }],
        asks: [{ price: 50001000, amount: 0.5 }],
        timestamp: new Date(),
      };
      mockUpbitService.getOrderBook.mockResolvedValue(mockOrderBook);

      const result = await service.getOrderBook('upbit', 'BTC-KRW');

      expect(mockUpbitService.getOrderBook).toHaveBeenCalledWith('BTC-KRW');
      expect(mockBinanceService.getOrderBook).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrderBook);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockOrderBook = {
        symbol: 'BTCUSDT',
        bids: [{ price: 50000, amount: 1.0 }],
        asks: [{ price: 50001, amount: 0.5 }],
        timestamp: new Date(),
      };
      mockBinanceService.getOrderBook.mockResolvedValue(mockOrderBook);

      const result = await service.getOrderBook('binance', 'BTCUSDT');

      expect(mockBinanceService.getOrderBook).toHaveBeenCalledWith('BTCUSDT');
      expect(mockUpbitService.getOrderBook).not.toHaveBeenCalled();
      expect(result).toEqual(mockOrderBook);
    });
  });

  describe('getWalletStatus', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockWalletStatus = {
        currency: 'BTC',
        canDeposit: true,
        canWithdraw: true,
      };
      mockUpbitService.getWalletStatus.mockResolvedValue(mockWalletStatus);

      const result = await service.getWalletStatus('upbit', 'BTC');

      expect(mockUpbitService.getWalletStatus).toHaveBeenCalledWith('BTC');
      expect(mockBinanceService.getWalletStatus).not.toHaveBeenCalled();
      expect(result).toEqual(mockWalletStatus);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockWalletStatus = {
        currency: 'BTC',
        canDeposit: true,
        canWithdraw: true,
      };
      mockBinanceService.getWalletStatus.mockResolvedValue(mockWalletStatus);

      const result = await service.getWalletStatus('binance', 'BTC');

      expect(mockBinanceService.getWalletStatus).toHaveBeenCalledWith('BTC');
      expect(mockUpbitService.getWalletStatus).not.toHaveBeenCalled();
      expect(result).toEqual(mockWalletStatus);
    });
  });

  describe('getDepositAddress', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockDepositAddress = {
        address: 'upbit-btc-address',
        tag: undefined,
        net_type: undefined,
      };
      mockUpbitService.getDepositAddress.mockResolvedValue(mockDepositAddress);

      const result = await service.getDepositAddress('upbit', 'BTC');

      expect(mockUpbitService.getDepositAddress).toHaveBeenCalledWith('BTC');
      expect(mockBinanceService.getDepositAddress).not.toHaveBeenCalled();
      expect(result).toEqual(mockDepositAddress);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockDepositAddress = {
        address: 'binance-btc-address',
        tag: 'memo-tag',
        net_type: 'BTC',
      };
      mockBinanceService.getDepositAddress.mockResolvedValue(
        mockDepositAddress,
      );

      const result = await service.getDepositAddress('binance', 'BTC');

      expect(mockBinanceService.getDepositAddress).toHaveBeenCalledWith('BTC');
      expect(mockUpbitService.getDepositAddress).not.toHaveBeenCalled();
      expect(result).toEqual(mockDepositAddress);
    });
  });

  describe('withdraw', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockWithdrawResult = { id: 'withdraw-123', status: 'pending' };
      mockUpbitService.withdraw.mockResolvedValue(mockWithdrawResult);

      const result = await service.withdraw(
        'upbit',
        'BTC',
        'destination-address',
        '0.001',
      );

      expect(mockUpbitService.withdraw).toHaveBeenCalledWith(
        'BTC',
        'destination-address',
        '0.001',
        undefined,
        undefined,
      );
      expect(mockBinanceService.withdraw).not.toHaveBeenCalled();
      expect(result).toEqual(mockWithdrawResult);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockWithdrawResult = { id: 'withdraw-456', status: 'pending' };
      mockBinanceService.withdraw.mockResolvedValue(mockWithdrawResult);

      const result = await service.withdraw(
        'binance',
        'BTC',
        'destination-address',
        '0.001',
        'secondary-address',
        'BTC',
      );

      expect(mockBinanceService.withdraw).toHaveBeenCalledWith(
        'BTC',
        'destination-address',
        '0.001',
        'secondary-address',
        'BTC',
      );
      expect(mockUpbitService.withdraw).not.toHaveBeenCalled();
      expect(result).toEqual(mockWithdrawResult);
    });
  });

  describe('getWithdrawalChance', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockWithdrawalChance = {
        currency: 'BTC',
        fee: 0.0005,
        minWithdrawal: 0.001,
      };
      mockUpbitService.getWithdrawalChance.mockResolvedValue(
        mockWithdrawalChance,
      );

      const result = await service.getWithdrawalChance('upbit', 'BTC');

      expect(mockUpbitService.getWithdrawalChance).toHaveBeenCalledWith('BTC');
      expect(mockBinanceService.getWithdrawalChance).not.toHaveBeenCalled();
      expect(result).toEqual(mockWithdrawalChance);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockWithdrawalChance = {
        currency: 'BTC',
        fee: 0.0005,
        minWithdrawal: 0.001,
      };
      mockBinanceService.getWithdrawalChance.mockResolvedValue(
        mockWithdrawalChance,
      );

      const result = await service.getWithdrawalChance('binance', 'BTC');

      expect(mockBinanceService.getWithdrawalChance).toHaveBeenCalledWith(
        'BTC',
      );
      expect(mockUpbitService.getWithdrawalChance).not.toHaveBeenCalled();
      expect(result).toEqual(mockWithdrawalChance);
    });
  });

  describe('getTickerInfo', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockTickerInfo = {
        symbol: 'BTC-KRW',
        quoteVolume: 1000000000,
      };
      mockUpbitService.getTickerInfo.mockResolvedValue(mockTickerInfo);

      const result = await service.getTickerInfo('upbit', 'BTC-KRW');

      expect(mockUpbitService.getTickerInfo).toHaveBeenCalledWith('BTC-KRW');
      expect(mockBinanceService.getTickerInfo).not.toHaveBeenCalled();
      expect(result).toEqual(mockTickerInfo);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockTickerInfo = {
        symbol: 'BTCUSDT',
        quoteVolume: 1000000000,
      };
      mockBinanceService.getTickerInfo.mockResolvedValue(mockTickerInfo);

      const result = await service.getTickerInfo('binance', 'BTCUSDT');

      expect(mockBinanceService.getTickerInfo).toHaveBeenCalledWith('BTCUSDT');
      expect(mockUpbitService.getTickerInfo).not.toHaveBeenCalled();
      expect(result).toEqual(mockTickerInfo);
    });
  });

  describe('cancelOrder', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockCancelResult = { orderId: 'order-123', status: 'cancelled' };
      mockUpbitService.cancelOrder.mockResolvedValue(mockCancelResult);

      const result = await service.cancelOrder('upbit', 'order-123', 'BTC-KRW');

      expect(mockUpbitService.cancelOrder).toHaveBeenCalledWith(
        'order-123',
        'BTC-KRW',
      );
      expect(mockBinanceService.cancelOrder).not.toHaveBeenCalled();
      expect(result).toEqual(mockCancelResult);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockCancelResult = { orderId: 'order-456', status: 'cancelled' };
      mockBinanceService.cancelOrder.mockResolvedValue(mockCancelResult);

      const result = await service.cancelOrder(
        'binance',
        'order-456',
        'BTCUSDT',
      );

      expect(mockBinanceService.cancelOrder).toHaveBeenCalledWith(
        'order-456',
        'BTCUSDT',
      );
      expect(mockUpbitService.cancelOrder).not.toHaveBeenCalled();
      expect(result).toEqual(mockCancelResult);
    });
  });

  describe('createFuturesOrder', () => {
    it('should delegate to binance service when exchange is binance', async () => {
      const mockFuturesOrder = {
        id: 'futures-order-123',
        symbol: 'BTCUSDT',
        side: 'buy' as OrderSide,
        type: 'limit' as OrderType,
        amount: 0.001,
        price: 50000,
        filledAmount: 0,
        status: 'open' as OrderStatus,
        timestamp: new Date(),
        fee: { currency: 'USDT', cost: 0 },
      };
      mockBinanceService.createFuturesOrder.mockResolvedValue(mockFuturesOrder);

      const result = await service.createFuturesOrder(
        'binance',
        'BTCUSDT',
        'buy',
        'limit',
        0.001,
        50000,
      );

      expect(mockBinanceService.createFuturesOrder).toHaveBeenCalledWith(
        'BTCUSDT',
        'buy',
        'limit',
        0.001,
        50000,
      );
      expect(result).toEqual(mockFuturesOrder);
    });

    it('should throw error when exchange is not binance', async () => {
      await expect(
        service.createFuturesOrder(
          'upbit' as ExchangeType,
          'BTC-KRW',
          'buy',
          'limit',
          0.001,
          50000000,
        ),
      ).rejects.toThrow('Futures trading is not supported on upbit.');
    });
  });

  describe('getFuturesBalances', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockFuturesBalances = [
        { currency: 'BTC', balance: 1.0, locked: 0.0, available: 1.0 },
      ];
      mockUpbitService.getFuturesBalances.mockResolvedValue(
        mockFuturesBalances,
      );

      const result = await service.getFuturesBalances('upbit', 'SPOT');

      expect(mockUpbitService.getFuturesBalances).toHaveBeenCalledWith('SPOT');
      expect(mockBinanceService.getFuturesBalances).not.toHaveBeenCalled();
      expect(result).toEqual(mockFuturesBalances);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockFuturesBalances = [
        { currency: 'BTC', balance: 1.0, locked: 0.0, available: 1.0 },
      ];
      mockBinanceService.getFuturesBalances.mockResolvedValue(
        mockFuturesBalances,
      );

      const result = await service.getFuturesBalances('binance', 'UMFUTURE');

      expect(mockBinanceService.getFuturesBalances).toHaveBeenCalledWith(
        'UMFUTURE',
      );
      expect(mockUpbitService.getFuturesBalances).not.toHaveBeenCalled();
      expect(result).toEqual(mockFuturesBalances);
    });
  });

  describe('internalTransfer', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockTransferResult = { id: 'transfer-123', status: 'completed' };
      mockUpbitService.internalTransfer.mockResolvedValue(mockTransferResult);

      const result = await service.internalTransfer(
        'upbit',
        'BTC',
        0.001,
        'SPOT',
        'FUTURES',
      );

      expect(mockUpbitService.internalTransfer).toHaveBeenCalledWith(
        'BTC',
        0.001,
        'SPOT',
        'FUTURES',
      );
      expect(mockBinanceService.internalTransfer).not.toHaveBeenCalled();
      expect(result).toEqual(mockTransferResult);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockTransferResult = { id: 'transfer-456', status: 'completed' };
      mockBinanceService.internalTransfer.mockResolvedValue(mockTransferResult);

      const result = await service.internalTransfer(
        'binance',
        'BTC',
        0.001,
        'SPOT',
        'UMFUTURE',
      );

      expect(mockBinanceService.internalTransfer).toHaveBeenCalledWith(
        'BTC',
        0.001,
        'SPOT',
        'UMFUTURE',
      );
      expect(mockUpbitService.internalTransfer).not.toHaveBeenCalled();
      expect(result).toEqual(mockTransferResult);
    });
  });

  describe('getDepositHistory', () => {
    it('should delegate to upbit service when exchange is upbit', async () => {
      const mockDepositHistory = [
        {
          id: 'deposit-123',
          symbol: 'BTC',
          amount: 0.001,
          status: 'COMPLETED' as const,
          timestamp: new Date(),
        },
      ];
      mockUpbitService.getDepositHistory.mockResolvedValue(mockDepositHistory);

      const result = await service.getDepositHistory('upbit', 'BTC');

      expect(mockUpbitService.getDepositHistory).toHaveBeenCalledWith(
        'BTC',
        undefined,
        undefined,
      );
      expect(mockBinanceService.getDepositHistory).not.toHaveBeenCalled();
      expect(result).toEqual(mockDepositHistory);
    });

    it('should delegate to binance service when exchange is binance', async () => {
      const mockDepositHistory = [
        {
          id: 'deposit-456',
          symbol: 'BTC',
          amount: 0.001,
          status: 'COMPLETED' as const,
          timestamp: new Date(),
        },
      ];
      mockBinanceService.getDepositHistory.mockResolvedValue(
        mockDepositHistory,
      );

      const startTime = new Date('2024-01-01');
      const endTime = new Date('2024-01-31');
      const result = await service.getDepositHistory(
        'binance',
        'BTC',
        startTime,
        endTime,
      );

      expect(mockBinanceService.getDepositHistory).toHaveBeenCalledWith(
        'BTC',
        startTime,
        endTime,
      );
      expect(mockUpbitService.getDepositHistory).not.toHaveBeenCalled();
      expect(result).toEqual(mockDepositHistory);
    });

    it('should throw error when service does not support deposit history', async () => {
      mockUpbitService.getDepositHistory = undefined;

      await expect(service.getDepositHistory('upbit', 'BTC')).rejects.toThrow(
        'upbit does not support deposit history retrieval',
      );
    });
  });

  describe('getUSDTtoKRW', () => {
    it('should return current rate', () => {
      // ExchangeService의 currentRate는 private이므로 직접 테스트하기 어려움
      // 실제로는 환율 업데이트 로직을 테스트해야 하지만, 여기서는 기본 동작만 확인
      const result = service.getUSDTtoKRW();
      expect(typeof result).toBe('number');
    });
  });
});
