import { Controller, Get } from '@nestjs/common';
import { KimPDashboardBeService } from './kim-p-dashboard-be.service';

@Controller()
export class KimPDashboardBeController {
  constructor(
    private readonly kimPDashboardBeService: KimPDashboardBeService,
  ) {}

  @Get()
  getHello(): string {
    return this.kimPDashboardBeService.getHello();
  }
}
