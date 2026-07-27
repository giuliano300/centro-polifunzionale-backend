import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './jwt.strategy';
import { MongooseModule } from '@nestjs/mongoose';
import { ManagerRegistrationOtp, ManagerRegistrationOtpSchema } from 'src/schemas/manager-registration-otp.schema';
import { ManagerPasswordReset, ManagerPasswordResetSchema } from 'src/schemas/manager-password-reset.schema';
import { ClientRegistrationOtp, ClientRegistrationOtpSchema } from 'src/schemas/client-registration-otp.schema';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: ManagerRegistrationOtp.name, schema: ManagerRegistrationOtpSchema },
      { name: ManagerPasswordReset.name, schema: ManagerPasswordResetSchema },
      { name: ClientRegistrationOtp.name, schema: ClientRegistrationOtpSchema },
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'a-string-secret-at-least-256-bits-long',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
