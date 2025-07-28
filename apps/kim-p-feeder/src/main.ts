import { NestFactory } from '@nestjs/core';
import { KimPFeederModule } from './kim-p-feeder.module';

async function bootstrap() {
  const app = await NestFactory.create(KimPFeederModule);
  await app.listen(process.env.port ?? 3001);
}
bootstrap();
