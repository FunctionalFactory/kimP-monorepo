import { Injectable } from '@nestjs/common';

@Injectable()
export class KimPInitiatorService {
  getHello(): string {
    return 'Hello World!';
  }
}
