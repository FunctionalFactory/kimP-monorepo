import { Test, TestingModule } from '@nestjs/testing';
import { KimPFeederService } from './kim-p-feeder.service';

describe('KimPFeederService', () => {
  let service: KimPFeederService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KimPFeederService],
    }).compile();

    service = module.get<KimPFeederService>(KimPFeederService);
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
