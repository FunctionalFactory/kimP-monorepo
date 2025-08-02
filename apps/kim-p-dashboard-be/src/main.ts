import { NestFactory } from '@nestjs/core';
import { KimPDashboardBeModule } from './kim-p-dashboard-be.module';

async function bootstrap() {
  const app = await NestFactory.create(KimPDashboardBeModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
