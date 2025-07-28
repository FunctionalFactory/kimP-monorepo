import { Test, TestingModule } from '@nestjs/testing';
import { KimPFeederController } from './kim-p-feeder.controller';
import { KimPFeederService } from './kim-p-feeder.service';

describe('KimPFeederController', () => {
  let kimPFeederController: KimPFeederController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KimPFeederController],
      providers: [KimPFeederService],
    }).compile();

    kimPFeederController = app.get<KimPFeederController>(KimPFeederController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(kimPFeederController.getHello()).toBe('Hello World!');
    });
  });
});
