import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../db/entities/system-setting.entity';

@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: string; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 60초

  constructor(
    @Inject('SYSTEM_SETTING_REPOSITORY')
    private systemSettingRepository: Repository<SystemSetting>,
  ) {}

  async getSetting(key: string): Promise<string | null> {
    // 캐시 확인
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value;
    }

    // DB에서 조회
    const setting = await this.systemSettingRepository.findOne({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    // 캐시 업데이트
    this.cache.set(key, {
      value: setting.value,
      timestamp: Date.now(),
    });

    return setting.value;
  }

  async updateSetting(
    key: string,
    value: string,
    description?: string,
  ): Promise<void> {
    let setting = await this.systemSettingRepository.findOne({
      where: { key },
    });

    if (setting) {
      setting.value = value;
      if (description) {
        setting.description = description;
      }
    } else {
      setting = this.systemSettingRepository.create({
        key,
        value,
        description,
      });
    }

    await this.systemSettingRepository.save(setting);

    // 캐시 무효화
    this.cache.delete(key);
  }

  async getAllSettings(): Promise<SystemSetting[]> {
    return this.systemSettingRepository.find({
      order: { key: 'ASC' },
    });
  }

  async deleteSetting(key: string): Promise<void> {
    await this.systemSettingRepository.delete({ key });
    this.cache.delete(key);
  }

  // 캐시 무효화
  clearCache(): void {
    this.cache.clear();
  }
}
