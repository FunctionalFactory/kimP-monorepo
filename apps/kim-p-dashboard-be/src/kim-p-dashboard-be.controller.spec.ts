import { Test, TestingModule } from '@nestjs/testing';
import { KimPDashboardBeController } from './kim-p-dashboard-be.controller';
import { KimPDashboardBeService } from './kim-p-dashboard-be.service';

describe('KimPDashboardBeController', () => {
  let kimPDashboardBeController: KimPDashboardBeController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [KimPDashboardBeController],
      providers: [KimPDashboardBeService],
    }).compile();

    kimPDashboardBeController = app.get<KimPDashboardBeController>(KimPDashboardBeController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(kimPDashboardBeController.getHello()).toBe('Hello World!');
    });
  });
});
