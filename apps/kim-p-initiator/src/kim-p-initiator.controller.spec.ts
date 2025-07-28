import { Test, TestingModule } from '@nestjs/testing';
import { KimPInitiatorController } from './kim-p-initiator.controller';
import { KimPInitiatorService } from './kim-p-initiator.service';

describe('KimPInitiatorController', () => {
  let kimPInitiatorController: KimPInitiatorController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KimPInitiatorController],
      providers: [KimPInitiatorService],
    }).compile();

    kimPInitiatorController = app.get<KimPInitiatorController>(KimPInitiatorController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(kimPInitiatorController.getHello()).toBe('Hello World!');
    });
  });
});
