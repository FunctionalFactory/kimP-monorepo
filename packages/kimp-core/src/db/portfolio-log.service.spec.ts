import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortfolioLogService } from './portfolio-log.service';
import { PortfolioLog } from './entities/portfolio-log.entity';

describe('PortfolioLogService', () => {
  let service: PortfolioLogService;
  let portfolioLogRepository: jest.Mocked<Repository<PortfolioLog>>;

  const mockPortfolioLog: Partial<PortfolioLog> = {
    id: 1,
    timestamp: new Date('2024-01-01T00:00:00Z'),
    upbit_balance_krw: 100000,
    binance_balance_krw: 200000,
    total_balance_krw: 300000,
    cycle_pnl_krw: 10000,
    cycle_pnl_rate_percent: 3.33,
    linked_arbitrage_cycle_id: 'cycle-uuid',
    remarks: '테스트 로그',
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortfolioLogService,
        {
          provide: getRepositoryToken(PortfolioLog),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<PortfolioLogService>(PortfolioLogService);
    portfolioLogRepository = module.get(getRepositoryToken(PortfolioLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.invalidateCache();
  });

  describe('createLog', () => {
    it('should call save with correct data', async () => {
      const logData = {
        timestamp: new Date('2024-01-01T00:00:00Z'),
        upbit_balance_krw: 100000,
        binance_balance_krw: 200000,
        total_balance_krw: 300000,
        cycle_pnl_krw: 10000,
        cycle_pnl_rate_percent: 3.33,
        linked_arbitrage_cycle_id: 'cycle-uuid',
        remarks: '테스트 로그',
      };
      const createdLog = { ...mockPortfolioLog, ...logData };
      portfolioLogRepository.create.mockReturnValue(createdLog as PortfolioLog);
      portfolioLogRepository.save.mockResolvedValue(createdLog as PortfolioLog);

      const result = await service.createLog(logData);

      expect(portfolioLogRepository.create).toHaveBeenCalledWith({
        ...logData,
      });
      expect(portfolioLogRepository.save).toHaveBeenCalledWith(createdLog);
      expect(result).toEqual(createdLog);
    });
  });
});
