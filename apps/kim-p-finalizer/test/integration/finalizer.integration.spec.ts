import { Test, TestingModule } from '@nestjs/testing';
import { KimPFinalizerModule } from '../../src/kim-p-finalizer.module';
import { FinalizerService } from '../../src/finalizer/finalizer.service';
import { CycleFinderService } from '../../src/finalizer/cycle-finder.service';
import { CycleSchedulerService } from '../../src/scheduler/cycle-scheduler.service';

describe('KimPFinalizer Integration Tests', () => {
  let module: TestingModule;
  let finalizerService: FinalizerService;
  let cycleFinderService: CycleFinderService;
  let cycleSchedulerService: CycleSchedulerService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [KimPFinalizerModule],
    }).compile();

    finalizerService = module.get<FinalizerService>(FinalizerService);
    cycleFinderService = module.get<CycleFinderService>(CycleFinderService);
    cycleSchedulerService = module.get<CycleSchedulerService>(
      CycleSchedulerService,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  it('should have all required services', () => {
    expect(finalizerService).toBeDefined();
    expect(cycleFinderService).toBeDefined();
    expect(cycleSchedulerService).toBeDefined();
  });

  it('should have proper service types', () => {
    expect(typeof finalizerService.processPendingCycles).toBe('function');
    expect(typeof cycleFinderService.findCycles).toBe('function');
    expect(typeof cycleSchedulerService.scheduleCycle).toBe('function');
  });

  it('should process pending cycles without throwing', async () => {
    await expect(
      finalizerService.processPendingCycles(),
    ).resolves.not.toThrow();
  });
});
