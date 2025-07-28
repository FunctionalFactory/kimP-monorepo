import { Controller, Get } from '@nestjs/common';
import { KimPInitiatorService } from './kim-p-initiator.service';

@Controller()
export class KimPInitiatorController {
  constructor(private readonly kimPInitiatorService: KimPInitiatorService) {}

  @Get()
  getHello(): string {
    return this.kimPInitiatorService.getHello();
  }
}
