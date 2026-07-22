import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { DashboardService } from 'src/services/dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  getStats() {
    return this.dashboardService.getStats();
  }
}
