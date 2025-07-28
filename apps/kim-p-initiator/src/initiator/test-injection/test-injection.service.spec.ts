import { Test, TestingModule } from '@nestjs/testing';
import { TestInjectionService } from './test-injection.service';

describe('TestInjectionService', () => {
  let service: TestInjectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TestInjectionService],
    }).compile();

    service = module.get<TestInjectionService>(TestInjectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
