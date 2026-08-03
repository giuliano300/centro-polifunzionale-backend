import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { RolesGuard } from 'src/roles/roles.guard';
import { NotificationsService } from 'src/services/notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('push/public-key')
  publicKey() { return this.notificationsService.publicKey(); }

  @Post('push/subscribe')
  @UseGuards(AuthGuard('jwt'))
  subscribe(@Req() req, @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return this.notificationsService.subscribe(req.user.userId, body);
  }

  @Delete('push/subscribe')
  @UseGuards(AuthGuard('jwt'))
  unsubscribe(@Req() req, @Body() body: { endpoint: string }) {
    return this.notificationsService.unsubscribe(req.user.userId, body.endpoint);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async findAll(@Req() req) {
    return this.notificationsService.findForUser(req.user.userId, req.user.role);
  }

  @Get('unread-count')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async unreadCount(@Req() req) {
    return this.notificationsService.unreadCount(req.user.userId, req.user.role);
  }

  @Patch('read-all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async markAllRead(@Req() req) {
    return this.notificationsService.markAllRead(req.user.userId, req.user.role);
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async markRead(@Param('id') id: string, @Req() req) {
    return this.notificationsService.markRead(id, req.user.userId, req.user.role);
  }
}
