import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramService } from './common/telegram.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // 로그 레벨 설정
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug', 'verbose'],
  });

  const telegramService = app.get(TelegramService);
  await telegramService.setWebhook();

  const logger = new Logger('Bootstrap');
  logger.log('🚀 KimP Arbitrage System Starting...');
  logger.log('📊 Single Session Test Mode Enabled');
  logger.log('�� Investment Amount: 250,000 KRW');

  await app.listen(process.env.PORT ?? 3000);

  logger.log(`✅ Server running on port ${process.env.PORT ?? 3000}`);
}
bootstrap();
