import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from '../../services/users.service';
import { User } from '../../schemas/user.schema';
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles, UserRole } from 'src/roles/roles.decorator';
import { GetUsersFilterDto } from 'src/filters/get-user-filters.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';
import { InviteClientDto } from 'src/dto/client-invite.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async findAll(@Query() filterDto: GetUsersFilterDto): Promise<User[]> {
    return this.usersService.findAll(filterDto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create({ ...dto, role: dto.role || UserRole.Cliente });
  }

  @Post('invite-client')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async inviteClient(@Body() dto: InviteClientDto, @Req() req): Promise<{ user: User; completeUrl: string; sent: boolean }> {
    return this.usersService.inviteClient(dto, req.user.userId);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async getMe(@Req() req): Promise<User> {
    return this.usersService.findById(req.user.userId);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async updateMe(@Req() req, @Body() dto: UpdateUserDto): Promise<User> {
    return this.usersService.updateSelf(req.user.userId, dto);
  }

  @Post('me/request-phone-otp')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore, UserRole.Cliente)
  async requestProfilePhoneOtp(@Req() req, @Body() dto: { phone: string }): Promise<{ requested: boolean; phone: string; expiresInMinutes: number; devPhoneOtp?: string }> {
    return this.usersService.requestProfilePhoneOtp(req.user.userId, dto.phone);
  }

  @Post('me/request-manager-upgrade')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Cliente)
  async requestManagerUpgrade(@Req() req): Promise<{ requested: boolean }> {
    return this.usersService.requestManagerUpgrade(req.user.userId);
  }
  
  @Get('email/:email')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async findOne(@Param('email') email: string): Promise<User | null> {
    return await this.usersService.findByEmail(email);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin, UserRole.Gestore)
  async getUser(@Param('id') id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.Admin)
  async deleteUser(@Param('id') id: string): Promise<{ deleted: boolean }> {
    return this.usersService.remove(id);
  }
}
