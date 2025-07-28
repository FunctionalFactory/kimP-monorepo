import { Injectable } from '@nestjs/common';

@Injectable()
export class KimPFeederService {
  getHello(): string {
    return 'Hello World!';
  }
}
