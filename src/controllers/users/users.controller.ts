import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from '../../services/users.service';
import { User } from '../../schemas/user.schema';
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/roles/roles.guard';
import { Roles } from 'src/roles/roles.decorator';
import { GetUsersFilterDto } from 'src/filters/get-user-filters.dto';
import { CreateUserDto } from 'src/dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore')
  async findAll(@Query() filterDto: GetUsersFilterDto): Promise<User[]> {
    return this.usersService.findAll(filterDto);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore')
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.create({ ...dto, role: dto.role || 'cliente' });
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore', 'cliente')
  async getMe(@Req() req): Promise<User> {
    return this.usersService.findById(req.user.userId);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore', 'cliente')
  async updateMe(@Req() req, @Body() dto: UpdateUserDto): Promise<User> {
    return this.usersService.updateSelf(req.user.userId, dto);
  }
  
  @Get('email/:email')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore')
  async findOne(@Param('email') email: string): Promise<User | null> {
    return await this.usersService.findByEmail(email);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'gestore')
  async getUser(@Param('id') id: string): Promise<User> {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<User> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin')
  async deleteUser(@Param('id') id: string): Promise<{ deleted: boolean }> {
    return this.usersService.remove(id);
  }
}
