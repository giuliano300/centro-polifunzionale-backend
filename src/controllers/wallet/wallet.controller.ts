import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { WalletService } from 'src/services/wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore')
  async summary(@Req() req, @Query('userId') userId?: string) {
    const targetUserId = req.user.role === 'admin' && userId ? userId : req.user.userId;
    return this.walletService.summary(targetUserId);
  }
}
