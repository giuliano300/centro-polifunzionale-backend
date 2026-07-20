import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemSettings, SystemSettingsSchema } from 'src/schemas/system-settings.schema';
import { SystemSettingsService } from 'src/services/system-settings.service';
import { SystemSettingsController } from './system-settings.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SystemSettings.name, schema: SystemSettingsSchema }]),
  ],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
