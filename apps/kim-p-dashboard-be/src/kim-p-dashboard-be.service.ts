import { Injectable } from '@nestjs/common';

@Injectable()
export class KimPDashboardBeService {
  getHello(): string {
    return 'Hello World!';
  }
}
