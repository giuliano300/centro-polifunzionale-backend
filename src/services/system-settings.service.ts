import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSettings, SystemSettingsDocument } from 'src/schemas/system-settings.schema';

const SETTINGS_KEY = 'global';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectModel(SystemSettings.name) private settingsModel: Model<SystemSettingsDocument>,
  ) {}

  async getSettings(): Promise<SystemSettings> {
    return this.settingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $setOnInsert: { key: SETTINGS_KEY, newUserWalletCredit: 0, newClientWalletCredit: 0, newManagerWalletCredit: 0 } },
      { new: true, upsert: true },
    ).exec();
  }

  async updateSettings(dto: { newUserWalletCredit?: number; newClientWalletCredit?: number; newManagerWalletCredit?: number }): Promise<SystemSettings> {
    const newUserWalletCredit = Math.max(Number(dto.newUserWalletCredit || 0), 0);
    const newClientWalletCredit = Math.max(Number(dto.newClientWalletCredit ?? newUserWalletCredit), 0);
    const newManagerWalletCredit = Math.max(Number(dto.newManagerWalletCredit ?? newUserWalletCredit), 0);
    return this.settingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { key: SETTINGS_KEY, newUserWalletCredit, newClientWalletCredit, newManagerWalletCredit },
      { new: true, upsert: true, runValidators: true },
    ).exec();
  }

  async newUserWalletCredit(role?: string): Promise<number> {
    const settings = await this.getSettings();
    if (role === 'cliente') {
      return Math.max(Number(settings.newClientWalletCredit ?? (settings.newUserWalletCredit || 0)), 0);
    }
    if (role === 'gestore') {
      return Math.max(Number(settings.newManagerWalletCredit ?? (settings.newUserWalletCredit || 0)), 0);
    }
    return Math.max(Number(settings.newUserWalletCredit || 0), 0);
  }
}
