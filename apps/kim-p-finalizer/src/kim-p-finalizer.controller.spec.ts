import { Test, TestingModule } from '@nestjs/testing';
import { KimPFinalizerController } from './kim-p-finalizer.controller';
import { KimPFinalizerService } from './kim-p-finalizer.service';

describe('KimPFinalizerController', () => {
  let kimPFinalizerController: KimPFinalizerController;
  let kimPFinalizerService: KimPFinalizerService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KimPFinalizerController],
      providers: [
        {
          provide: KimPFinalizerService,
          useValue: {
            getHello: jest.fn().mockReturnValue('Hello World!'),
          },
        },
      ],
    }).compile();

    kimPFinalizerController = app.get<KimPFinalizerController>(
      KimPFinalizerController,
    );
    kimPFinalizerService = app.get<KimPFinalizerService>(KimPFinalizerService);
  });

  it('should be defined', () => {
    expect(kimPFinalizerController).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(kimPFinalizerController.getHello()).toBe('Hello World!');
      expect(kimPFinalizerService.getHello).toHaveBeenCalled();
    });
  });
});
