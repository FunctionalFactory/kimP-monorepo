import { Injectable } from '@nestjs/common';

@Injectable()
export class KimPFinalizerService {
  getHello(): string {
    return 'Hello World!';
  }
}
