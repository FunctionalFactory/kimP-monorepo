import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface TelegramBotCommand {
  command: string;
  description: string;
  handler: (chatId: string, args?: string[]) => Promise<string>;
}

@Injectable()
export class TelegramService {
  private readonly BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  private readonly CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  private readonly WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;

  private commands: Map<string, TelegramBotCommand> = new Map();

  private readonly logger = new Logger(TelegramService.name);

  constructor() {
    this.initializeCommands();
  }

  private initializeCommands() {
    this.commands.set('status', {
      command: '/status',
      description: '현재 시스템 상태 조회',
      handler: async () => 'Status command handler will be injected',
    });

    this.commands.set('sessions', {
      command: '/sessions',
      description: '현재 활성 세션 정보',
      handler: async () => 'Sessions command handler will be injected',
    });

    this.commands.set('portfolio', {
      command: '/portfolio',
      description: '현재 포트폴리오 및 손익률',
      handler: async () => 'Portfolio command handler will be injected',
    });

    this.commands.set('premiums', {
      command: '/premiums',
      description: '최고/최저 프리미엄 코인 정보',
      handler: async () => 'Premiums command handler will be injected',
    });

    this.commands.set('help', {
      command: '/help',
      description: '사용 가능한 명령어 목록',
      handler: async () => this.getHelpMessage(),
    });
  }

  async sendMessage(text: string, chatId?: string) {
    const targetChatId = chatId || this.CHAT_ID;
    const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;
    try {
      await axios.post(url, {
        chat_id: targetChatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
    } catch (err) {
      console.error(
        '❌ Telegram 전송 실패:',
        err.response?.data || err.message,
      );
    }
  }

  async sendMessageWithKeyboard(text: string, keyboard: any, chatId?: string) {
    const targetChatId = chatId || this.CHAT_ID;
    const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: targetChatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: true,
      });
    } catch (err) {
      this.logger.error(
        '❌ Telegram 키보드 메시지 전송 실패:',
        err.response?.data || err.message,
      );
    }
  }
  async handleWebhookUpdate(update: any): Promise<void> {
    if (!update.message) return;

    const { chat, text } = update.message;
    const chatId = chat.id.toString();

    // // 허용된 채팅 ID만 처리
    // if (chatId !== this.CHAT_ID) {
    //   await this.sendMessage('❌ 권한이 없습니다.', chatId);
    //   return;
    // }

    if (!text) return;

    const command = this.parseCommand(text);
    if (!command) {
      await this.sendMessage(
        '❌ 잘못된 명령어입니다. /help를 입력하세요.',
        chatId,
      );
      return;
    }

    try {
      const handler = this.commands.get(command.name)?.handler;
      if (handler) {
        const response = await handler(chatId, command.args);
        await this.sendMessage(response, chatId);
      } else {
        await this.sendMessage(
          '❌ 명령어를 찾을 수 없습니다. /help를 입력하세요.',
          chatId,
        );
      }
    } catch (error) {
      this.logger.error('명령어 처리 중 오류:', error);
      await this.sendMessage('❌ 명령어 처리 중 오류가 발생했습니다.', chatId);
    }
  }

  private parseCommand(text: string): { name: string; args?: string[] } | null {
    if (!text.startsWith('/')) return null;

    const parts = text.split(' ');
    const commandName = parts[0].substring(1).toLowerCase();
    const args = parts.slice(1);

    return { name: commandName, args };
  }

  private getHelpMessage(): string {
    let helpText = '🤖 *kimP 봇 명령어*\n\n';

    for (const [key, cmd] of this.commands) {
      helpText += `${cmd.command} - ${cmd.description}\n`;
    }

    helpText += '\n💡 자동 알림은 거래 완료 시 자동으로 전송됩니다.';

    return helpText;
  }

  injectCommandHandler(
    commandName: string,
    handler: (chatId: string, args?: string[]) => Promise<string>,
  ) {
    const command = this.commands.get(commandName);
    if (command) {
      command.handler = handler;
    }
  }

  // 웹훅 설정
  async setWebhook(): Promise<void> {
    if (!this.WEBHOOK_URL) {
      this.logger.warn('WEBHOOK_URL이 설정되지 않았습니다.');
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/setWebhook`;
      await axios.post(url, {
        url: this.WEBHOOK_URL,
        allowed_updates: ['message'],
      });
      this.logger.log('✅ Telegram 웹훅 설정 완료');
    } catch (error) {
      this.logger.error(
        '❌ Telegram 웹훅 설정 실패:',
        error.response?.data || error.message,
      );
    }
  }

  async deleteWebhook(): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.BOT_TOKEN}/deleteWebhook`;
      await axios.post(url);
      this.logger.log('✅ Telegram 웹훅 제거 완료');
    } catch (error) {
      this.logger.error(
        '❌ Telegram 웹훅 제거 실패:',
        error.response?.data || error.message,
      );
    }
  }
}
