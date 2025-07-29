import { Test, TestingModule } from '@nestjs/testing';
import { KimPFinalizerService } from './kim-p-finalizer.service';

describe('KimPFinalizerService', () => {
  let service: KimPFinalizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KimPFinalizerService],
    }).compile();

    service = module.get<KimPFinalizerService>(KimPFinalizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });

    it('should return a string', () => {
      const result = service.getHello();
      expect(typeof result).toBe('string');
    });
  });
});
