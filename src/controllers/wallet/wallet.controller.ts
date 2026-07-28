import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { WalletService } from 'src/services/wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async summary(@Req() req, @Query('userId') userId?: string) {
    const targetUserId = req.user.role === UserRole.Admin && userId ? userId : req.user.userId;
    return this.walletService.summary(targetUserId);
  }

  @Post('manual-credit')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  async manualCredit(@Body() dto: { userId: string; amount: number; description?: string }) {
    return this.walletService.creditManual(dto.userId, Number(dto.amount || 0), dto.description);
  }
}
