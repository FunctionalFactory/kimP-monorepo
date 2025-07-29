import { Test, TestingModule } from '@nestjs/testing';
import { KimPInitiatorController } from './kim-p-initiator.controller';
import { KimPInitiatorService } from './kim-p-initiator.service';

describe('KimPInitiatorController', () => {
  let kimPInitiatorController: KimPInitiatorController;
  let kimPInitiatorService: KimPInitiatorService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KimPInitiatorController],
      providers: [
        {
          provide: KimPInitiatorService,
          useValue: {
            getHello: jest.fn().mockReturnValue('Hello World!'),
          },
        },
      ],
    }).compile();

    kimPInitiatorController = app.get<KimPInitiatorController>(
      KimPInitiatorController,
    );
    kimPInitiatorService = app.get<KimPInitiatorService>(KimPInitiatorService);
  });

  it('should be defined', () => {
    expect(kimPInitiatorController).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(kimPInitiatorController.getHello()).toBe('Hello World!');
      expect(kimPInitiatorService.getHello).toHaveBeenCalled();
    });
  });
});
