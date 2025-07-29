import { Test, TestingModule } from '@nestjs/testing';
import { KimPInitiatorService } from './kim-p-initiator.service';

describe('KimPInitiatorService', () => {
  let service: KimPInitiatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KimPInitiatorService],
    }).compile();

    service = module.get<KimPInitiatorService>(KimPInitiatorService);
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
