import { Test, TestingModule } from '@nestjs/testing';
import { KimpCoreService } from './kimp-core.service';

describe('KimpCoreService', () => {
  let service: KimpCoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KimpCoreService],
    }).compile();

    service = module.get<KimpCoreService>(KimpCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
