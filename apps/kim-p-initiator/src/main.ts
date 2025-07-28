import { NestFactory } from '@nestjs/core';
import { KimPInitiatorModule } from './kim-p-initiator.module';

async function bootstrap() {
  const app = await NestFactory.create(KimPInitiatorModule);
  await app.listen(process.env.port ?? 3002);
}
bootstrap();
