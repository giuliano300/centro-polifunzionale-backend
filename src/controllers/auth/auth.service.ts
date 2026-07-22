import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../services/users.service';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../../dto/create-user.dto';
import { User } from 'src/schemas/user.schema';
import { UserDto } from 'src/dto/user.dto';
import { ResetPasswordDto } from 'src/dto/reset-password.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ManagerRegistrationOtp, ManagerRegistrationOtpDocument } from 'src/schemas/manager-registration-otp.schema';
import { ConfirmManagerRegistrationOtpDto, RequestManagerRegistrationOtpDto } from 'src/dto/manager-registration.dto';
import { ManagerPasswordReset, ManagerPasswordResetDocument } from 'src/schemas/manager-password-reset.schema';
import { ConfirmManagerPasswordResetDto, RequestManagerPasswordResetDto } from 'src/dto/manager-password-reset.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/roles/user-role.enum';
import { CompleteClientInviteDto, RequestClientInvitePhoneOtpDto } from 'src/dto/client-invite.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(ManagerRegistrationOtp.name) private otpModel: Model<ManagerRegistrationOtpDocument>,
    @InjectModel(ManagerPasswordReset.name) private passwordResetModel: Model<ManagerPasswordResetDocument>,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | 'disabled' | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      return null;
    }

    if (user.isActive === false) {
      return 'disabled';
    }

    return user;
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
    return this.usersService.resetPasswordByEmail(dto.email, dto.password, [UserRole.Gestore, UserRole.Admin]);
  }

  async requestManagerPasswordReset(dto: RequestManagerPasswordResetDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user || ![UserRole.Gestore, UserRole.Admin].includes(user.role)) {
      throw new BadRequestException('Email gestore non trovata');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    await this.passwordResetModel.updateMany({ email, used: false }, { $set: { used: true } }).exec();
    await this.passwordResetModel.create({
      email,
      tokenHash,
      used: false,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const frontUrl = this.configService.get<string>('GESTORE_FRONTEND_URL', 'http://localhost:4400');
    const resetUrl = `${frontUrl.replace(/\/$/, '')}/login?resetToken=${encodeURIComponent(token)}`;

    return {
      sent: false,
      email,
      expiresInMinutes: 30,
      devResetUrl: resetUrl,
    };
  }

  async confirmManagerPasswordReset(dto: ConfirmManagerPasswordResetDto) {
    const requests = await this.passwordResetModel
      .find({ used: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();

    for (const request of requests) {
      const isMatch = await bcrypt.compare(dto.token, request.tokenHash);
      if (!isMatch) {
        continue;
      }

      await this.usersService.resetPasswordByEmail(request.email, dto.password, [UserRole.Gestore, UserRole.Admin]);
      request.used = true;
      await request.save();
      return { updated: true, email: request.email };
    }

    throw new BadRequestException('Link scaduto o non valido');
  }

  async requestManagerRegistrationOtp(dto: RequestManagerRegistrationOtpDto) {
    const normalized = this.normalizeManagerRegistration(dto);
    await this.usersService.assertUniqueIdentity(normalized.email, normalized.phone, normalized.taxCode);

    const emailOtp = this.generateOtp();
    const phoneOtp = this.generateOtp();
    const [emailOtpHash, phoneOtpHash, passwordHash] = await Promise.all([
      bcrypt.hash(emailOtp, 10),
      bcrypt.hash(phoneOtp, 10),
      bcrypt.hash(normalized.password, 10),
    ]);

    await this.otpModel.deleteMany({ email: normalized.email }).exec();
    await this.otpModel.create({
      ...normalized,
      passwordHash,
      emailOtpHash,
      phoneOtpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    return {
      requested: true,
      email: normalized.email,
      phone: normalized.phone,
      expiresInMinutes: 10,
      devEmailOtp: emailOtp,
      devPhoneOtp: phoneOtp,
    };
  }

  async confirmManagerRegistrationOtp(dto: ConfirmManagerRegistrationOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const request = await this.otpModel.findOne({ email }).sort({ createdAt: -1 }).exec();
    if (!request || request.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP scaduto o non valido');
    }

    if (request.attempts >= 5) {
      await this.otpModel.deleteOne({ _id: request._id }).exec();
      throw new BadRequestException('Troppi tentativi. Richiedi un nuovo OTP');
    }

    const [isEmailOtpValid, isPhoneOtpValid] = await Promise.all([
      bcrypt.compare(dto.emailOtp, request.emailOtpHash),
      bcrypt.compare(dto.phoneOtp, request.phoneOtpHash),
    ]);
    if (!isEmailOtpValid || !isPhoneOtpValid) {
      request.attempts += 1;
      await request.save();
      throw new BadRequestException('OTP email o cellulare non valido');
    }

    await this.usersService.assertUniqueIdentity(request.email, request.phone, request.taxCode);
    const user = await this.usersService.create({
      name: request.name,
      email: request.email,
      phone: request.phone,
      taxCode: request.taxCode,
      password: this.randomPasswordPlaceholder(),
      role: UserRole.Gestore,
      isActive: true,
    });
    user.password = request.passwordHash;
    await (user as User & { save?: () => Promise<User> }).save?.();
    await this.otpModel.deleteMany({ email: request.email }).exec();

    return {
      registered: true,
      user,
    };
  }

  async completeClientRegistration(dto: CompleteClientInviteDto) {
    return this.usersService.completeClientInvite(dto);
  }

  async requestClientInvitePhoneOtp(dto: RequestClientInvitePhoneOtpDto) {
    return this.usersService.requestInvitePhoneOtp(dto);
  }

  async getClientInviteDetails(token: string) {
    return this.usersService.getInviteDetails(token);
  }

  private normalizeManagerRegistration(dto: RequestManagerRegistrationOtpDto): RequestManagerRegistrationOtpDto {
    return {
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.replace(/[\s./()-]/g, ''),
      taxCode: dto.taxCode.trim().toUpperCase(),
      password: dto.password,
    };
  }

  private randomPasswordPlaceholder(): string {
    return `Tmp${Math.random().toString(36).slice(2, 10)}!`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
