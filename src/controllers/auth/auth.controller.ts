import { Controller, Get, Post, Body, Query, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../../dto/create-user.dto';
import { LoginDto } from '../../dto/login.dto';
import { ResetPasswordDto } from 'src/dto/reset-password.dto';
import { ConfirmManagerRegistrationOtpDto, RequestManagerRegistrationOtpDto } from 'src/dto/manager-registration.dto';
import { ConfirmManagerPasswordResetDto, RequestManagerPasswordResetDto } from 'src/dto/manager-password-reset.dto';
import { CompleteClientInviteDto, RequestClientInvitePhoneOtpDto } from 'src/dto/client-invite.dto';
import { ConfirmClientRegistrationOtpDto, RequestClientRegistrationOtpDto } from 'src/dto/client-registration.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (user === 'disabled') {
      throw new UnauthorizedException('Utente disattivato, contattare l amministrazione.');
    }
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('manager/reset-password')
  async resetManagerPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetManagerPassword(dto);
  }

  @Post('manager/password-reset/request-link')
  async requestManagerPasswordReset(@Body() dto: RequestManagerPasswordResetDto) {
    return this.authService.requestManagerPasswordReset(dto);
  }

  @Post('manager/password-reset/confirm')
  async confirmManagerPasswordReset(@Body() dto: ConfirmManagerPasswordResetDto) {
    return this.authService.confirmManagerPasswordReset(dto);
  }

  @Post('client/password-reset/request-link')
  async requestClientPasswordReset(@Body() dto: RequestManagerPasswordResetDto) {
    return this.authService.requestClientPasswordReset(dto);
  }

  @Post('client/password-reset/confirm')
  async confirmClientPasswordReset(@Body() dto: ConfirmManagerPasswordResetDto) {
    return this.authService.confirmClientPasswordReset(dto);
  }

  @Post('client/register/request-otp')
  async requestClientRegistrationOtp(@Body() dto: RequestClientRegistrationOtpDto) {
    return this.authService.requestClientRegistrationOtp(dto);
  }

  @Post('client/register/confirm-otp')
  async confirmClientRegistrationOtp(@Body() dto: ConfirmClientRegistrationOtpDto) {
    return this.authService.confirmClientRegistrationOtp(dto);
  }

  @Post('manager/register/request-otp')
  async requestManagerRegistrationOtp(@Body() dto: RequestManagerRegistrationOtpDto) {
    return this.authService.requestManagerRegistrationOtp(dto);
  }

  @Post('manager/register/confirm-otp')
  async confirmManagerRegistrationOtp(@Body() dto: ConfirmManagerRegistrationOtpDto) {
    return this.authService.confirmManagerRegistrationOtp(dto);
  }

  @Post('client/complete-registration')
  async completeClientRegistration(@Body() dto: CompleteClientInviteDto) {
    return this.authService.completeClientRegistration(dto);
  }

  @Post('client/complete-registration/request-phone-otp')
  async requestClientInvitePhoneOtp(@Body() dto: RequestClientInvitePhoneOtpDto) {
    return this.authService.requestClientInvitePhoneOtp(dto);
  }

  @Get('client/complete-registration')
  async getClientInviteDetails(@Query('token') token: string) {
    return this.authService.getClientInviteDetails(token);
  }
}
