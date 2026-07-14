import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../services/users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../../dto/create-user.dto';
import { User } from 'src/schemas/user.schema';
import { UserDto } from 'src/dto/user.dto';
import { ResetPasswordDto } from 'src/dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && user.isActive !== false && await bcrypt.compare(password, user.password))
      return user;

    return null;
  }

  async login(user: Partial<UserDto>) {
    const payload = { email: user.email, name: user.name, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  async resetManagerPassword(dto: ResetPasswordDto) {
    return this.usersService.resetPasswordByEmail(dto.email, dto.password, ['gestore', 'admin']);
  }
}
