import {
  Controller,
  Get,
  Put,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SettingsService } from '@app/kimp-core';

interface UpdateSettingDto {
  key: string;
  value: string;
  description?: string;
}

interface UpdateSettingsDto {
  settings: UpdateSettingDto[];
}

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAllSettings() {
    try {
      const settings = await this.settingsService.getAllSettings();
      return {
        success: true,
        data: settings,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '설정을 가져오는 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  async updateSettings(@Body() updateSettingsDto: UpdateSettingsDto) {
    try {
      const { settings } = updateSettingsDto;

      if (!Array.isArray(settings) || settings.length === 0) {
        throw new HttpException(
          '설정 배열이 필요합니다.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const results = [];
      for (const setting of settings) {
        const { key, value, description } = setting;

        if (!key || value === undefined) {
          throw new HttpException(
            'key와 value는 필수입니다.',
            HttpStatus.BAD_REQUEST,
          );
        }

        await this.settingsService.updateSetting(key, value, description);
        results.push({ key, value, description });
      }

      return {
        success: true,
        message: `${results.length}개의 설정이 업데이트되었습니다.`,
        data: results,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        '설정을 업데이트하는 중 오류가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
