import { NestFactory } from '@nestjs/core';
import { KimPDashboardBeModule } from './kim-p-dashboard-be.module';

async function bootstrap() {
  const app = await NestFactory.create(KimPDashboardBeModule);

  // CORS 설정 추가
  app.enableCors({
    origin: ['http://localhost:4000', 'http://localhost:4001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  await app.listen(process.env.port ?? 4000);
}
bootstrap();
