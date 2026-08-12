import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
import { ClientRegistrationOtp, ClientRegistrationOtpDocument } from 'src/schemas/client-registration-otp.schema';
import { ConfirmClientRegistrationOtpDto, RequestClientRegistrationOtpDto } from 'src/dto/client-registration.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { UserRole } from 'src/roles/user-role.enum';
import { CompleteClientInviteDto, RequestClientInvitePhoneOtpDto } from 'src/dto/client-invite.dto';
import { CompleteSocialRegistrationDto, RequestSocialPhoneOtpDto, SocialSignInDto } from 'src/dto/social-auth.dto';
import { SocialAuthCompletion, SocialAuthCompletionDocument } from 'src/schemas/social-auth-completion.schema';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const OTP_VALIDITY_MINUTES = 2;
const OTP_RESEND_SECONDS = 120;
const OTP_RESEND_MILLISECONDS = OTP_RESEND_SECONDS * 1000;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(ManagerRegistrationOtp.name) private otpModel: Model<ManagerRegistrationOtpDocument>,
    @InjectModel(ManagerPasswordReset.name) private passwordResetModel: Model<ManagerPasswordResetDocument>,
    @InjectModel(ClientRegistrationOtp.name) private clientOtpModel: Model<ClientRegistrationOtpDocument>,
    @InjectModel(SocialAuthCompletion.name) private socialCompletionModel: Model<SocialAuthCompletionDocument>,
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

  async socialSignIn(dto: SocialSignInDto) {
    const identity = await this.verifySocialIdentity(dto.provider, dto.idToken, dto.name);
    let user = await this.usersService.findBySocialIdentity(dto.provider, identity.subject);
    if (!user) {
      user = await this.usersService.findByEmail(identity.email) as any;
    }

    if (user?.isActive === false) {
      throw new UnauthorizedException('Utente disattivato, contattare l amministrazione.');
    }
    if (user && ![UserRole.Gestore, UserRole.Admin].includes(user.role)) {
      throw new ForbiddenException('Questa email appartiene a un profilo cliente.');
    }

    if (user) {
      const linked = await this.usersService.linkSocialIdentity(String((user as any)._id || (user as any).id), dto.provider, identity.subject);
      return { completionRequired: false, ...(await this.login(linked as any)) };
    }

    const jti = randomBytes(18).toString('hex');
    const completionToken = this.jwtService.sign({
      purpose: 'social-registration',
      jti,
      provider: dto.provider,
      providerSubject: identity.subject,
      email: identity.email,
      name: identity.name,
      userId: user ? String((user as any)._id || (user as any).id) : undefined,
    }, { expiresIn: '20m' });

    return {
      completionRequired: true,
      completionToken,
      profile: { name: identity.name, email: identity.email },
      missingFields: ['phone', 'taxCode', 'acceptedDataProcessing', 'phoneOtp'],
    };
  }

  async requestSocialPhoneOtp(dto: RequestSocialPhoneOtpDto) {
    const payload = await this.verifySocialCompletionToken(dto.completionToken);
    const phone = dto.phone.replace(/[\s./()-]/g, '');
    const previousRequest = await this.socialCompletionModel.findOne({ jti: payload.jti }).exec();
    if (previousRequest?.lastOtpRequestedAt) {
      const elapsed = Date.now() - previousRequest.lastOtpRequestedAt.getTime();
      if (elapsed < OTP_RESEND_MILLISECONDS) {
        const retryAfterSeconds = Math.ceil((OTP_RESEND_MILLISECONDS - elapsed) / 1000);
        throw new HttpException({
          message: `Attendi ${retryAfterSeconds} secondi prima di richiedere un nuovo OTP.`,
          retryAfterSeconds,
        }, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    const phoneOtp = this.generateOtp();
    await this.socialCompletionModel.findOneAndUpdate(
      { jti: payload.jti },
      {
        $set: {
          phone,
          phoneOtpHash: await bcrypt.hash(phoneOtp, 10),
          attempts: 0,
          used: false,
          lastOtpRequestedAt: new Date(),
          expiresAt: new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000),
        },
      },
      { upsert: true, new: true },
    ).exec();
    return {
      requested: true,
      phone,
      expiresInMinutes: OTP_VALIDITY_MINUTES,
      retryAfterSeconds: OTP_RESEND_SECONDS,
      ...(this.configService.get<string>('NODE_ENV') === 'production' ? {} : { devPhoneOtp: phoneOtp }),
    };
  }

  async completeSocialRegistration(dto: CompleteSocialRegistrationDto) {
    if (!dto.acceptedDataProcessing) {
      throw new BadRequestException('Devi accettare il trattamento dei dati personali.');
    }
    const payload = await this.verifySocialCompletionToken(dto.completionToken);
    const request = await this.socialCompletionModel.findOne({ jti: payload.jti, used: false }).exec();
    if (!request || request.expiresAt.getTime() < Date.now() || request.phone !== dto.phone.replace(/[\s./()-]/g, '')) {
      throw new BadRequestException('OTP scaduto o non valido.');
    }
    if (request.attempts >= 5 || !await bcrypt.compare(dto.phoneOtp, request.phoneOtpHash)) {
      request.attempts += 1;
      await request.save();
      throw new BadRequestException('OTP cellulare non valido.');
    }

    const user = await this.usersService.completeSocialProfile({
      userId: payload.userId,
      provider: payload.provider,
      providerSubject: payload.providerSubject,
      email: payload.email,
      name: dto.name,
      phone: dto.phone,
      taxCode: dto.taxCode,
    });
    request.used = true;
    await request.save();
    return { completionRequired: false, ...(await this.login(user as any)) };
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

  async requestClientPasswordReset(dto: RequestManagerPasswordResetDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user || user.role !== UserRole.Cliente) {
      throw new BadRequestException('Email cliente non trovata');
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

    const frontUrl = this.configService.get<string>('CLIENTE_FRONTEND_URL', 'http://localhost:4500');
    const resetUrl = `${frontUrl.replace(/\/$/, '')}/login?resetToken=${encodeURIComponent(token)}`;

    return {
      sent: false,
      email,
      expiresInMinutes: 30,
      devResetUrl: resetUrl,
    };
  }

  async confirmClientPasswordReset(dto: ConfirmManagerPasswordResetDto) {
    const requests = await this.passwordResetModel
      .find({ used: false, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();

    for (const request of requests) {
      const isMatch = await bcrypt.compare(dto.token, request.tokenHash);
      if (!isMatch) {
        continue;
      }

      await this.usersService.resetPasswordByEmail(request.email, dto.password, [UserRole.Cliente]);
      request.used = true;
      await request.save();
      return { updated: true, email: request.email };
    }

    throw new BadRequestException('Link scaduto o non valido');
  }

  async requestClientRegistrationOtp(dto: RequestClientRegistrationOtpDto) {
    const normalized = this.normalizeClientRegistration(dto);
    const previousRequest = await this.clientOtpModel.findOne({ email: normalized.email }).sort({ requestedAt: -1 }).exec();
    this.assertOtpResendAllowed(previousRequest?.requestedAt);
    await this.usersService.assertUniqueIdentity(normalized.email, normalized.phone, normalized.taxCode);

    const emailOtp = this.generateOtp();
    const phoneOtp = this.generateOtp();
    const [emailOtpHash, phoneOtpHash, passwordHash] = await Promise.all([
      bcrypt.hash(emailOtp, 10),
      bcrypt.hash(phoneOtp, 10),
      bcrypt.hash(normalized.password, 10),
    ]);

    await this.clientOtpModel.deleteMany({ email: normalized.email }).exec();
    await this.clientOtpModel.create({
      ...normalized,
      acceptedDataProcessingAt: new Date(),
      requestedAt: new Date(),
      passwordHash,
      emailOtpHash,
      phoneOtpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000),
    });

    return {
      requested: true,
      email: normalized.email,
      phone: normalized.phone,
      expiresInMinutes: OTP_VALIDITY_MINUTES,
      retryAfterSeconds: OTP_RESEND_SECONDS,
      devEmailOtp: emailOtp,
      devPhoneOtp: phoneOtp,
    };
  }

  async confirmClientRegistrationOtp(dto: ConfirmClientRegistrationOtpDto) {
    const email = dto.email.trim().toLowerCase();
    const request = await this.clientOtpModel.findOne({ email }).sort({ createdAt: -1 }).exec();
    if (!request || request.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('OTP scaduto o non valido');
    }

    if (request.attempts >= 5) {
      await this.clientOtpModel.deleteOne({ _id: request._id }).exec();
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
      role: UserRole.Cliente,
      isActive: true,
      interestedTags: request.interestedTags || [],
    });
    user.password = request.passwordHash;
    user.acceptedDataProcessingAt = request.acceptedDataProcessingAt;
    await (user as User & { save?: () => Promise<User> }).save?.();
    await this.clientOtpModel.deleteMany({ email: request.email }).exec();

    return {
      registered: true,
      user,
    };
  }

  async requestManagerRegistrationOtp(dto: RequestManagerRegistrationOtpDto) {
    const normalized = this.normalizeManagerRegistration(dto);
    const previousRequest = await this.otpModel.findOne({ email: normalized.email }).sort({ requestedAt: -1 }).exec();
    this.assertOtpResendAllowed(previousRequest?.requestedAt);
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
      acceptedDataProcessingAt: new Date(),
      requestedAt: new Date(),
      passwordHash,
      emailOtpHash,
      phoneOtpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000),
    });

    return {
      requested: true,
      email: normalized.email,
      phone: normalized.phone,
      expiresInMinutes: OTP_VALIDITY_MINUTES,
      retryAfterSeconds: OTP_RESEND_SECONDS,
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
    user.acceptedDataProcessingAt = request.acceptedDataProcessingAt;
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
      acceptedDataProcessing: dto.acceptedDataProcessing,
    };
  }

  private normalizeClientRegistration(dto: RequestClientRegistrationOtpDto): RequestClientRegistrationOtpDto {
    return {
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.replace(/[\s./()-]/g, ''),
      taxCode: dto.taxCode.trim().toUpperCase(),
      password: dto.password,
      interestedTags: Array.isArray(dto.interestedTags)
        ? [...new Set(dto.interestedTags.map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean))]
        : [],
      acceptedDataProcessing: dto.acceptedDataProcessing,
    };
  }

  private randomPasswordPlaceholder(): string {
    return `Tmp${Math.random().toString(36).slice(2, 10)}!`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private assertOtpResendAllowed(requestedAt?: Date): void {
    if (!requestedAt) return;
    const elapsed = Date.now() - requestedAt.getTime();
    if (elapsed >= OTP_RESEND_MILLISECONDS) return;
    const retryAfterSeconds = Math.ceil((OTP_RESEND_MILLISECONDS - elapsed) / 1000);
    throw new HttpException({
      message: `Attendi ${retryAfterSeconds} secondi prima di richiedere nuovi OTP.`,
      retryAfterSeconds,
    }, HttpStatus.TOO_MANY_REQUESTS);
  }

  private async verifySocialIdentity(provider: 'google' | 'facebook', idToken: string, suppliedName?: string) {
    if (provider === 'facebook') {
      return this.verifyFacebookIdentity(idToken);
    }
    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) {
      throw new ServiceUnavailableException('Accesso Google non configurato.');
    }
    const jwksUrl = 'https://www.googleapis.com/oauth2/v3/certs';
    const issuer = ['https://accounts.google.com', 'accounts.google.com'];
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(idToken, createRemoteJWKSet(new URL(jwksUrl)), { audience, issuer }));
    } catch {
      throw new UnauthorizedException('Identità social non valida o scaduta.');
    }
    const email = String(payload.email || '').trim().toLowerCase();
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!payload.sub || !email || !emailVerified) {
      throw new UnauthorizedException('Il provider non ha restituito un indirizzo email verificato.');
    }
    return {
      subject: payload.sub,
      email,
      name: String(payload.name || suppliedName || '').trim(),
    };
  }

  private async verifyFacebookIdentity(accessToken: string) {
    const appId = this.configService.get<string>('FACEBOOK_APP_ID');
    const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('Accesso Facebook non configurato.');
    }

    try {
      const debugUrl = new URL('https://graph.facebook.com/debug_token');
      debugUrl.searchParams.set('input_token', accessToken);
      debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`);
      const debugResponse = await fetch(debugUrl);
      const debugPayload = await debugResponse.json() as any;
      const tokenData = debugPayload?.data;
      if (!debugResponse.ok || !tokenData?.is_valid || String(tokenData.app_id) !== appId || !tokenData.user_id) {
        throw new Error('invalid Facebook token');
      }

      const profileUrl = new URL('https://graph.facebook.com/me');
      profileUrl.searchParams.set('fields', 'id,name,email');
      profileUrl.searchParams.set('access_token', accessToken);
      const profileResponse = await fetch(profileUrl);
      const profile = await profileResponse.json() as any;
      const email = String(profile?.email || '').trim().toLowerCase();
      if (!profileResponse.ok || String(profile?.id) !== String(tokenData.user_id) || !email) {
        throw new Error('Facebook profile without email');
      }
      return { subject: String(profile.id), email, name: String(profile.name || '').trim() };
    } catch {
      throw new UnauthorizedException('Identità Facebook non valida oppure email non disponibile.');
    }
  }

  private async verifySocialCompletionToken(token: string): Promise<{
    jti: string;
    provider: 'google' | 'facebook';
    providerSubject: string;
    email: string;
    name: string;
    userId?: string;
  }> {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      if (payload?.purpose !== 'social-registration' || !payload?.jti || !payload?.providerSubject || !payload?.email) {
        throw new Error('invalid payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Sessione social scaduta. Ripeti l’accesso.');
    }
  }
}
