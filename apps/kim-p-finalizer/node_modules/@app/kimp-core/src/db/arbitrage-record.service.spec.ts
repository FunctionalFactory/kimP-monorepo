import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArbitrageRecordService } from './arbitrage-record.service';
import {
  ArbitrageCycle,
  ArbitrageCycleStatus,
} from './entities/arbitrage-cycle.entity';
import { Trade, TradeType, TradeStatus } from './entities/trade.entity';

describe('ArbitrageRecordService', () => {
  let service: ArbitrageRecordService;
  let arbitrageCycleRepository: jest.Mocked<Repository<ArbitrageCycle>>;
  let tradeRepository: jest.Mocked<Repository<Trade>>;

  // Mock 데이터
  const mockArbitrageCycle: Partial<ArbitrageCycle> = {
    id: 'test-cycle-id',
    status: 'AWAITING_REBALANCE',
    startTime: new Date('2024-01-01T00:00:00Z'),
    lockedAt: null,
    retryCount: 0,
    totalNetProfitKrw: 1000,
    totalNetProfitPercent: 1.5,
    initialInvestmentKrw: 100000,
  };

  const mockTrade: Partial<Trade> = {
    id: 'test-trade-id',
    tradeType: 'HIGH_PREMIUM_BUY' as TradeType,
    status: 'COMPLETED' as TradeStatus,
    cycleId: 'test-cycle-id',
  };

  beforeEach(async () => {
    // Mock repository 생성
    const mockArbitrageCycleRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        transaction: jest.fn(),
      },
    };

    const mockTradeRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArbitrageRecordService,
        {
          provide: getRepositoryToken(ArbitrageCycle),
          useValue: mockArbitrageCycleRepo,
        },
        {
          provide: getRepositoryToken(Trade),
          useValue: mockTradeRepo,
        },
      ],
    }).compile();

    service = module.get<ArbitrageRecordService>(ArbitrageRecordService);
    arbitrageCycleRepository = module.get(getRepositoryToken(ArbitrageCycle));
    tradeRepository = module.get(getRepositoryToken(Trade));
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.invalidateCache();
  });

  describe('createArbitrageCycle', () => {
    it('should create a new arbitrage cycle with STARTED status', async () => {
      const cycleData = { initialInvestmentKrw: 100000 };
      const createdCycle = {
        ...mockArbitrageCycle,
        ...cycleData,
        status: 'STARTED',
      };

      arbitrageCycleRepository.create.mockReturnValue(
        createdCycle as ArbitrageCycle,
      );
      arbitrageCycleRepository.save.mockResolvedValue(
        createdCycle as ArbitrageCycle,
      );

      const result = await service.createArbitrageCycle(cycleData);

      expect(arbitrageCycleRepository.create).toHaveBeenCalledWith(cycleData);
      expect(arbitrageCycleRepository.save).toHaveBeenCalledWith(createdCycle);
      expect(result.status).toBe('STARTED');
      expect(result.initialInvestmentKrw).toBe(100000);
    });
  });

  describe('updateArbitrageCycle', () => {
    it('should update an arbitrage cycle successfully', async () => {
      const updateData = {
        status: 'COMPLETED' as ArbitrageCycleStatus,
        totalNetProfitKrw: 2000,
      };
      const updatedCycle = { ...mockArbitrageCycle, ...updateData };

      arbitrageCycleRepository.findOne.mockResolvedValue(
        mockArbitrageCycle as ArbitrageCycle,
      );
      arbitrageCycleRepository.save.mockResolvedValue(
        updatedCycle as ArbitrageCycle,
      );

      const result = await service.updateArbitrageCycle(
        'test-cycle-id',
        updateData,
      );

      expect(arbitrageCycleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
      });
      expect(arbitrageCycleRepository.save).toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
      expect(result.totalNetProfitKrw).toBe(2000);
    });

    it('should throw error when cycle not found', async () => {
      arbitrageCycleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateArbitrageCycle('non-existent-id', {
          status: 'COMPLETED' as ArbitrageCycleStatus,
        }),
      ).rejects.toThrow('Arbitrage cycle with ID non-existent-id not found.');
    });

    it('should sanitize Infinity values in numeric fields', async () => {
      const updateData = {
        totalNetProfitKrw: Infinity,
        totalNetProfitPercent: -Infinity,
        initialInvestmentKrw: NaN,
      };
      const sanitizedCycle = {
        ...mockArbitrageCycle,
        totalNetProfitKrw: 0,
        totalNetProfitPercent: 0,
        initialInvestmentKrw: 0,
      };

      arbitrageCycleRepository.findOne.mockResolvedValue(
        mockArbitrageCycle as ArbitrageCycle,
      );
      arbitrageCycleRepository.save.mockResolvedValue(
        sanitizedCycle as ArbitrageCycle,
      );

      const result = await service.updateArbitrageCycle(
        'test-cycle-id',
        updateData,
      );

      expect(result.totalNetProfitKrw).toBe(0);
      expect(result.totalNetProfitPercent).toBe(0);
      expect(result.initialInvestmentKrw).toBe(0);
    });
  });

  describe('getArbitrageCycle', () => {
    it('should return cycle from cache if available', async () => {
      // 먼저 캐시에 데이터를 넣기 위해 업데이트 실행
      arbitrageCycleRepository.findOne.mockResolvedValue(
        mockArbitrageCycle as ArbitrageCycle,
      );
      arbitrageCycleRepository.save.mockResolvedValue(
        mockArbitrageCycle as ArbitrageCycle,
      );

      await service.updateArbitrageCycle('test-cycle-id', {
        status: 'COMPLETED' as ArbitrageCycleStatus,
      });

      // 캐시된 데이터 조회
      const result = await service.getArbitrageCycle('test-cycle-id');

      expect(result).toEqual(mockArbitrageCycle);
      // 캐시에서 반환되므로 DB 조회가 호출되지 않음
      expect(arbitrageCycleRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should fetch from database if not in cache', async () => {
      arbitrageCycleRepository.findOne.mockResolvedValue(
        mockArbitrageCycle as ArbitrageCycle,
      );

      const result = await service.getArbitrageCycle('test-cycle-id');

      expect(arbitrageCycleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
      });
      expect(result).toEqual(mockArbitrageCycle);
    });

    it('should return null when cycle not found', async () => {
      arbitrageCycleRepository.findOne.mockResolvedValue(null);

      const result = await service.getArbitrageCycle('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findAndLockNextCycle', () => {
    it('should find and lock the oldest AWAITING_REBALANCE cycle', async () => {
      // UPDATE 쿼리를 위한 QueryBuilder 모의 객체
      const mockUpdateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      // SELECT 쿼리를 위한 QueryBuilder 모의 객체 (setLock 포함)
      const mockSelectQueryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue(mockArbitrageCycle as ArbitrageCycle),
      };

      // createQueryBuilder가 두 번 호출되므로 각각 다른 모의 객체 반환
      arbitrageCycleRepository.createQueryBuilder
        .mockReturnValueOnce(mockUpdateQueryBuilder as any)
        .mockReturnValueOnce(mockSelectQueryBuilder as any);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          createQueryBuilder: jest
            .fn()
            .mockReturnValueOnce(mockUpdateQueryBuilder)
            .mockReturnValueOnce(mockSelectQueryBuilder),
          save: jest
            .fn()
            .mockResolvedValue(mockArbitrageCycle as ArbitrageCycle),
        });
      });

      arbitrageCycleRepository.manager.transaction = mockTransaction;

      const result = await service.findAndLockNextCycle();

      expect(mockTransaction).toHaveBeenCalled();
      expect(mockUpdateQueryBuilder.update).toHaveBeenCalledWith(
        ArbitrageCycle,
      );
      expect(mockSelectQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
      );
      expect(mockSelectQueryBuilder.where).toHaveBeenCalledWith(
        'cycle.status = :status',
        { status: 'AWAITING_REBALANCE' },
      );
      expect(mockSelectQueryBuilder.orderBy).toHaveBeenCalledWith(
        'cycle.startTime',
        'ASC',
      );
      expect(result).toEqual(mockArbitrageCycle);
    });

    it('should return null when no AWAITING_REBALANCE cycles found', async () => {
      // UPDATE 쿼리를 위한 QueryBuilder 모의 객체
      const mockUpdateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      // SELECT 쿼리를 위한 QueryBuilder 모의 객체 (null 반환)
      const mockSelectQueryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      // createQueryBuilder가 두 번 호출되므로 각각 다른 모의 객체 반환
      arbitrageCycleRepository.createQueryBuilder
        .mockReturnValueOnce(mockUpdateQueryBuilder as any)
        .mockReturnValueOnce(mockSelectQueryBuilder as any);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          createQueryBuilder: jest
            .fn()
            .mockReturnValueOnce(mockUpdateQueryBuilder)
            .mockReturnValueOnce(mockSelectQueryBuilder),
        });
      });

      arbitrageCycleRepository.manager.transaction = mockTransaction;

      const result = await service.findAndLockNextCycle();

      expect(result).toBeNull();
    });

    it('should release timed-out locks and reset status to AWAITING_REBALANCE', async () => {
      // UPDATE 쿼리를 위한 QueryBuilder 모의 객체 (affected: 2 반환)
      const mockUpdateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };

      // SELECT 쿼리를 위한 QueryBuilder 모의 객체 (null 반환)
      const mockSelectQueryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      // createQueryBuilder가 두 번 호출되므로 각각 다른 모의 객체 반환
      arbitrageCycleRepository.createQueryBuilder
        .mockReturnValueOnce(mockUpdateQueryBuilder as any)
        .mockReturnValueOnce(mockSelectQueryBuilder as any);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          createQueryBuilder: jest
            .fn()
            .mockReturnValueOnce(mockUpdateQueryBuilder)
            .mockReturnValueOnce(mockSelectQueryBuilder),
        });
      });

      arbitrageCycleRepository.manager.transaction = mockTransaction;

      const result = await service.findAndLockNextCycle();

      expect(mockUpdateQueryBuilder.update).toHaveBeenCalledWith(
        ArbitrageCycle,
      );
      expect(mockUpdateQueryBuilder.set).toHaveBeenCalledWith({
        status: 'AWAITING_REBALANCE',
        lockedAt: null,
        errorDetails: expect.any(Function),
      });
      expect(mockUpdateQueryBuilder.where).toHaveBeenCalledWith(
        'status = :status',
        {
          status: 'REBALANCING_IN_PROGRESS',
        },
      );
      expect(result).toBeNull();
    });
  });

  describe('createTrade', () => {
    it('should create a new trade successfully', async () => {
      const tradeData = {
        tradeType: 'HIGH_PREMIUM_BUY' as TradeType,
        cycleId: 'test-cycle-id',
      };
      const createdTrade = { ...mockTrade, ...tradeData };

      tradeRepository.create.mockReturnValue(createdTrade as Trade);
      tradeRepository.save.mockResolvedValue(createdTrade as Trade);

      const result = await service.createTrade(tradeData);

      expect(tradeRepository.create).toHaveBeenCalledWith(tradeData);
      expect(tradeRepository.save).toHaveBeenCalledWith(createdTrade);
      expect(result.tradeType).toBe('HIGH_PREMIUM_BUY');
      expect(result.cycleId).toBe('test-cycle-id');
    });
  });

  describe('updateTrade', () => {
    it('should update a trade successfully', async () => {
      const updateData = { status: 'COMPLETED' as TradeStatus };
      const updatedTrade = { ...mockTrade, ...updateData };

      tradeRepository.findOne.mockResolvedValue(mockTrade as Trade);
      tradeRepository.save.mockResolvedValue(updatedTrade as Trade);

      const result = await service.updateTrade('test-trade-id', updateData);

      expect(tradeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-trade-id' },
      });
      expect(tradeRepository.save).toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw error when trade not found', async () => {
      tradeRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateTrade('non-existent-id', {
          status: 'COMPLETED' as TradeStatus,
        }),
      ).rejects.toThrow('Trade with ID non-existent-id not found.');
    });
  });

  describe('getTrade', () => {
    it('should return trade by id', async () => {
      tradeRepository.findOne.mockResolvedValue(mockTrade as Trade);

      const result = await service.getTrade('test-trade-id');

      expect(tradeRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-trade-id' },
      });
      expect(result).toEqual(mockTrade);
    });

    it('should return null when trade not found', async () => {
      tradeRepository.findOne.mockResolvedValue(null);

      const result = await service.getTrade('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getTradesByCycleId', () => {
    it('should return all trades for a cycle', async () => {
      const mockTrades = [mockTrade as Trade];
      tradeRepository.find.mockResolvedValue(mockTrades);

      const result = await service.getTradesByCycleId('test-cycle-id');

      expect(tradeRepository.find).toHaveBeenCalledWith({
        where: { cycleId: 'test-cycle-id' },
      });
      expect(result).toEqual(mockTrades);
    });
  });

  describe('getCycleWithTrades', () => {
    it('should return cycle with related trades', async () => {
      const cycleWithTrades = {
        ...mockArbitrageCycle,
        trades: [mockTrade as Trade],
      };
      arbitrageCycleRepository.findOne.mockResolvedValue(
        cycleWithTrades as ArbitrageCycle,
      );

      const result = await service.getCycleWithTrades('test-cycle-id');

      expect(arbitrageCycleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-cycle-id' },
        relations: ['trades'],
      });
      expect(result).toEqual(cycleWithTrades);
    });
  });

  describe('batchUpdateArbitrageCycles', () => {
    it('should update multiple cycles successfully', async () => {
      const updates = [
        {
          id: 'cycle-1',
          data: { status: 'COMPLETED' as ArbitrageCycleStatus },
        },
        { id: 'cycle-2', data: { status: 'FAILED' as ArbitrageCycleStatus } },
      ];

      const updatedCycles = [
        { ...mockArbitrageCycle, id: 'cycle-1', status: 'COMPLETED' },
        { ...mockArbitrageCycle, id: 'cycle-2', status: 'FAILED' },
      ];

      arbitrageCycleRepository.findOne
        .mockResolvedValueOnce(updatedCycles[0] as ArbitrageCycle)
        .mockResolvedValueOnce(updatedCycles[1] as ArbitrageCycle);

      arbitrageCycleRepository.save
        .mockResolvedValueOnce(updatedCycles[0] as ArbitrageCycle)
        .mockResolvedValueOnce(updatedCycles[1] as ArbitrageCycle);

      const result = await service.batchUpdateArbitrageCycles(updates);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('COMPLETED');
      expect(result[1].status).toBe('FAILED');
    });

    it('should throw error when one update fails', async () => {
      const updates = [
        {
          id: 'cycle-1',
          data: { status: 'COMPLETED' as ArbitrageCycleStatus },
        },
        { id: 'cycle-2', data: { status: 'FAILED' as ArbitrageCycleStatus } },
      ];

      arbitrageCycleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.batchUpdateArbitrageCycles(updates),
      ).rejects.toThrow();
    });
  });

  describe('cache management', () => {
    it('should invalidate specific cache entry', () => {
      // 캐시에 데이터 추가
      service['cycleCache'].set(
        'test-id',
        mockArbitrageCycle as ArbitrageCycle,
      );
      service['cacheTimestamps'].set('test-id', Date.now());

      service.invalidateCache('test-id');

      expect(service['cycleCache'].has('test-id')).toBe(false);
      expect(service['cacheTimestamps'].has('test-id')).toBe(false);
    });

    it('should invalidate all cache entries', () => {
      // 캐시에 데이터 추가
      service['cycleCache'].set(
        'test-id-1',
        mockArbitrageCycle as ArbitrageCycle,
      );
      service['cycleCache'].set(
        'test-id-2',
        mockArbitrageCycle as ArbitrageCycle,
      );
      service['cacheTimestamps'].set('test-id-1', Date.now());
      service['cacheTimestamps'].set('test-id-2', Date.now());

      service.invalidateCache();

      expect(service['cycleCache'].size).toBe(0);
      expect(service['cacheTimestamps'].size).toBe(0);
    });

    it('should return cache statistics', () => {
      service['cycleCache'].set(
        'test-id',
        mockArbitrageCycle as ArbitrageCycle,
      );

      const stats = service.getCacheStats();

      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBe(0); // TODO: 히트율 계산 로직이 아직 구현되지 않음
    });
  });
});
