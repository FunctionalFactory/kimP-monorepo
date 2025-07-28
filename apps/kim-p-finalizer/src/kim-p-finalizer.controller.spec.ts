import { Test, TestingModule } from '@nestjs/testing';
import { KimPFinalizerController } from './kim-p-finalizer.controller';
import { KimPFinalizerService } from './kim-p-finalizer.service';

describe('KimPFinalizerController', () => {
  let kimPFinalizerController: KimPFinalizerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KimPFinalizerController],
      providers: [KimPFinalizerService],
    }).compile();

    kimPFinalizerController = app.get<KimPFinalizerController>(KimPFinalizerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(kimPFinalizerController.getHello()).toBe('Hello World!');
    });
  });
});
