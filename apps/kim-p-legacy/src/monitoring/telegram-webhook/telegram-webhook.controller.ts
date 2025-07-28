import { Controller, Post, Body, Logger } from '@nestjs/common';
import { TelegramService } from '../../common/telegram.service';

@Controller('telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  async handleWebhook(@Body() update: any) {
    this.logger.debug('Telegram 웹훅 수신:', update);

    try {
      await this.telegramService.handleWebhookUpdate(update);
    } catch (error) {
      this.logger.error('웹훅 처리 중 오류:', error);
    }
  }
}
