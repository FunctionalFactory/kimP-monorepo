import { Controller, Get } from '@nestjs/common';
import { KimPFeederService } from './kim-p-feeder.service';

@Controller()
export class KimPFeederController {
  constructor(private readonly kimPFeederService: KimPFeederService) {}

  @Get()
  getHello(): string {
    return this.kimPFeederService.getHello();
  }
}
