import { NestFactory } from '@nestjs/core';
import { KimPFinalizerModule } from './kim-p-finalizer.module';

async function bootstrap() {
  const app = await NestFactory.create(KimPFinalizerModule);
  await app.listen(process.env.port ?? 3003);
}
bootstrap();
