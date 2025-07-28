import { Controller, Get } from '@nestjs/common';
import { KimPFinalizerService } from './kim-p-finalizer.service';

@Controller()
export class KimPFinalizerController {
  constructor(private readonly kimPFinalizerService: KimPFinalizerService) {}

  @Get()
  getHello(): string {
    return this.kimPFinalizerService.getHello();
  }
}
