import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { SystemSettingsService } from 'src/services/system-settings.service';

@Controller('system-settings')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.Admin)
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  getSettings() {
    return this.systemSettingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: { newUserWalletCredit?: number; newClientWalletCredit?: number; newManagerWalletCredit?: number }) {
    return this.systemSettingsService.updateSettings(dto);
  }
}
