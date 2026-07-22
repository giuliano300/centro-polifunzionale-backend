import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { GetUsersFilterDto } from 'src/filters/get-user-filters.dto';
import { WalletService } from './wallet.service';
import { SystemSettingsService } from './system-settings.service';
import { UserRole } from 'src/roles/user-role.enum';
import { InviteClientDto, CompleteClientInviteDto, RequestClientInvitePhoneOtpDto } from 'src/dto/client-invite.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private walletService: WalletService,
    private systemSettingsService: SystemSettingsService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const normalizedUser = this.normalizeOptionalIdentityFields(createUserDto);
    this.validateTaxCode(normalizedUser.taxCode);
    this.validateItalianMobilePhone(normalizedUser.phone);
    await this.assertUniqueIdentity(normalizedUser.email, normalizedUser.phone, normalizedUser.taxCode);
    const hashedPassword = await bcrypt.hash(normalizedUser.password, 10);
    const createdUser = new this.userModel({
      ...normalizedUser,
      password: hashedPassword,
      role: normalizedUser.role || UserRole.Cliente,
      registrationStatus: 'complete',
    });
    const savedUser = await createdUser.save();
    if (savedUser.role !== UserRole.Admin) {
      const credit = await this.systemSettingsService.newUserWalletCredit(savedUser.role);
      if (credit > 0) {
        await this.walletService.creditSignupBonus(
          (savedUser._id as Types.ObjectId).toString(),
          credit,
          'Credito iniziale nuovo iscritto',
        );
      }
    }
    return savedUser;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userModel.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  async assertUniqueIdentity(email?: string, phone?: string, taxCode?: string): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.trim();
    const normalizedTaxCode = taxCode?.trim().toUpperCase();
    const or: Record<string, string>[] = [];

    if (normalizedEmail) {
      or.push({ email: normalizedEmail });
    }
    if (normalizedPhone) {
      or.push({ phone: normalizedPhone });
    }
    if (normalizedTaxCode) {
      or.push({ taxCode: normalizedTaxCode });
    }

    if (!or.length) {
      return;
    }

    const existing = await this.userModel.findOne({ $or: or }).exec();
    if (!existing) {
      return;
    }

    if (normalizedEmail && existing.email === normalizedEmail) {
      throw new BadRequestException('Email gia registrata');
    }
    if (normalizedPhone && existing.phone === normalizedPhone) {
      throw new BadRequestException('Cellulare gia registrato');
    }
    if (normalizedTaxCode && existing.taxCode === normalizedTaxCode) {
      throw new BadRequestException('Codice fiscale gia registrato');
    }

    throw new BadRequestException('Utente gia registrato');
  }

  async resetPasswordByEmail(email: string, password: string, allowedRoles?: string[]): Promise<{ updated: boolean }> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }

    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      throw new BadRequestException('Recupero password non disponibile per questo utente');
    }

    user.password = await bcrypt.hash(password, 10);
    user.isActive = true;
    await user.save();
    return { updated: true };
  }

  async findAll(filterDto: GetUsersFilterDto): Promise<User[]> {
    const { email, role, excludeRole, search, limit = 10, page = 1, sortBy = '_id', sortOrder = 'desc' } = filterDto;

    const filter: Record<string, unknown> = {};    
    if (email) filter.email = email;
    if (role) filter.role = role;
    if (excludeRole) filter.role = { $ne: excludeRole };
    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: pattern },
        { email: pattern },
        { phone: pattern },
        { taxCode: pattern },
      ];
    }

    return this.userModel
      .find(filter)
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();  
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('Utente non trovato');
    }
    return user;
  }

  async inviteClient(dto: InviteClientDto, invitedBy: string): Promise<{ user: User; completeUrl: string; sent: boolean }> {
    return this.inviteUser(dto, invitedBy);
  }

  async inviteUser(dto: InviteClientDto & { role?: UserRole }, invitedBy: string): Promise<{ user: User; completeUrl: string; sent: boolean }> {
    const normalized = this.normalizeOptionalIdentityFields({ ...dto, email: dto.email.trim().toLowerCase() });
    this.validateTaxCode(normalized.taxCode);
    this.validateItalianMobilePhone(normalized.phone);
    await this.assertUniqueIdentity(normalized.email, normalized.phone, normalized.taxCode);

    const token = randomBytes(32).toString('hex');
    const user = await this.userModel.create({
      ...normalized,
      password: await bcrypt.hash(this.randomPasswordPlaceholder(), 10),
      role: dto.role === UserRole.Gestore ? UserRole.Gestore : UserRole.Cliente,
      isActive: false,
      registrationStatus: 'invited',
      invitedBy: new Types.ObjectId(invitedBy),
      completionTokenHash: await bcrypt.hash(token, 10),
      completionTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      user,
      completeUrl: `${this.configService.get<string>('GESTORE_FRONTEND_URL', 'http://localhost:4400').replace(/\/$/, '')}/complete-registration?token=${encodeURIComponent(token)}`,
      sent: false,
    };
  }

  async completeClientInvite(dto: CompleteClientInviteDto): Promise<{ completed: boolean; user: User }> {
    if (!dto.acceptedDataProcessing) {
      throw new BadRequestException('Devi accettare il trattamento dei dati');
    }

    const user = await this.findPendingInviteByToken(dto.token);
    const normalized = this.normalizeOptionalIdentityFields({
      name: dto.name,
      phone: dto.phone || user.phone,
      taxCode: dto.taxCode || user.taxCode,
    });
    this.validateTaxCode(normalized.taxCode);
    this.validateItalianMobilePhone(normalized.phone);
    await this.assertUniqueIdentityExcludingUser(
      (user._id as Types.ObjectId).toString(),
      undefined,
      normalized.phone,
      normalized.taxCode,
    );

    if (
      !dto.phoneOtp ||
      !user.completionPhoneOtpHash ||
      user.completionPhoneOtpTarget !== normalized.phone ||
      !user.completionPhoneOtpExpiresAt ||
      user.completionPhoneOtpExpiresAt.getTime() < Date.now() ||
      !await bcrypt.compare(dto.phoneOtp, user.completionPhoneOtpHash)
    ) {
      throw new BadRequestException('OTP cellulare non valido o scaduto');
    }

    user.name = normalized.name;
    user.phone = normalized.phone;
    user.taxCode = normalized.taxCode;
    user.password = await bcrypt.hash(dto.password, 10);
    user.isActive = true;
    user.registrationStatus = 'complete';
    user.completionTokenHash = undefined;
    user.completionTokenExpiresAt = undefined;
    user.completionPhoneOtpHash = undefined;
    user.completionPhoneOtpTarget = undefined;
    user.completionPhoneOtpExpiresAt = undefined;
    const saved = await user.save();

    const credit = await this.systemSettingsService.newUserWalletCredit(saved.role);
    if (credit > 0) {
      await this.walletService.creditSignupBonus(
        (saved._id as Types.ObjectId).toString(),
        credit,
        'Premio completamento registrazione',
      );
    }

    return { completed: true, user: saved };
  }

  async requestInvitePhoneOtp(dto: RequestClientInvitePhoneOtpDto): Promise<{ requested: boolean; phone: string; expiresInMinutes: number; devPhoneOtp?: string }> {
    const user = await this.findPendingInviteByToken(dto.token);
    const phone = this.normalizeItalianMobilePhone(dto.phone);
    this.validateItalianMobilePhone(phone);
    await this.assertUniqueIdentityExcludingUser((user._id as Types.ObjectId).toString(), undefined, phone);

    const phoneOtp = this.generateOtp();
    user.completionPhoneOtpHash = await bcrypt.hash(phoneOtp, 10);
    user.completionPhoneOtpTarget = phone;
    user.completionPhoneOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    return {
      requested: true,
      phone,
      expiresInMinutes: 10,
      devPhoneOtp: phoneOtp,
    };
  }

  async getInviteDetails(token: string): Promise<Pick<User, 'name' | 'email' | 'phone' | 'taxCode' | 'role'> & { expiresAt?: Date }> {
    const user = await this.findPendingInviteByToken(token);
    return {
      name: user.name,
      email: user.email,
      phone: user.phone,
      taxCode: user.taxCode,
      role: user.role,
      expiresAt: user.completionTokenExpiresAt,
    };
  }

  private async findPendingInviteByToken(token: string): Promise<UserDocument> {
    const requests = await this.userModel.find({
      role: { $in: [UserRole.Cliente, UserRole.Gestore] },
      registrationStatus: 'invited',
      isActive: false,
      completionTokenExpiresAt: { $gt: new Date() },
    }).exec();

    for (const user of requests) {
      if (!user.completionTokenHash || !await bcrypt.compare(token, user.completionTokenHash)) {
        continue;
      }

      return user;
    }

    throw new BadRequestException('Link registrazione scaduto o non valido');
  }

  async updateSelf(id: string, dto: UpdateUserDto): Promise<User> {
    const allowedDto: UpdateUserDto = {
      name: dto.name,
      phone: dto.phone,
      taxCode: dto.taxCode,
      password: dto.password,
    };

    return this.update(id, allowedDto);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const current = await this.findById(id);
    if (current.role === UserRole.Admin && dto.isActive === false) {
      throw new BadRequestException('Non puoi disattivare un amministratore');
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    const normalizedDto = this.normalizeOptionalIdentityFields(dto);
    this.validateTaxCode(normalizedDto.taxCode);
    this.validateItalianMobilePhone(normalizedDto.phone);

    const updated = await this.userModel.findByIdAndUpdate(id, normalizedDto, {
      new: true,
      runValidators: true,
    }).exec();

    if (!updated) {
      throw new NotFoundException('Utente non trovato');
    }

    if (current.role === UserRole.Gestore && current.isActive !== false && normalizedDto.isActive === false) {
      this.notificationsService.emitAccountDisabled(id);
    }

    return updated;
  }
  // users.service.ts
  async remove(id: string): Promise<{ deleted: boolean }> {
    const current = await this.findById(id);
    if (current.role === UserRole.Admin) {
      throw new BadRequestException('Non puoi eliminare un amministratore');
    }

    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Utente non trovato');
    }
    return { deleted: true };
  }

  private normalizeOptionalIdentityFields<T extends { email?: string; phone?: string; taxCode?: string }>(dto: T): T {
    const normalized = { ...dto };
    if (normalized.email) {
      normalized.email = normalized.email.trim().toLowerCase();
    }
    if (normalized.phone) {
      normalized.phone = this.normalizeItalianMobilePhone(normalized.phone);
    }
    if (normalized.phone === '') {
      delete normalized.phone;
    }
    if (normalized.taxCode === '') {
      delete normalized.taxCode;
    }
    if (normalized.taxCode) {
      normalized.taxCode = normalized.taxCode.toUpperCase();
    }
    return normalized;
  }

  private normalizeItalianMobilePhone(phone: string): string {
    return phone.replace(/[\s./()-]/g, '');
  }

  private async assertUniqueIdentityExcludingUser(userId: string, email?: string, phone?: string, taxCode?: string): Promise<void> {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.trim();
    const normalizedTaxCode = taxCode?.trim().toUpperCase();
    const or: Record<string, string>[] = [];

    if (normalizedEmail) {
      or.push({ email: normalizedEmail });
    }
    if (normalizedPhone) {
      or.push({ phone: normalizedPhone });
    }
    if (normalizedTaxCode) {
      or.push({ taxCode: normalizedTaxCode });
    }
    if (!or.length) {
      return;
    }

    const existing = await this.userModel.findOne({ _id: { $ne: userId }, $or: or }).exec();
    if (!existing) {
      return;
    }
    if (normalizedEmail && existing.email === normalizedEmail) {
      throw new BadRequestException('Email gia registrata');
    }
    if (normalizedPhone && existing.phone === normalizedPhone) {
      throw new BadRequestException('Cellulare gia registrato');
    }
    if (normalizedTaxCode && existing.taxCode === normalizedTaxCode) {
      throw new BadRequestException('Codice fiscale gia registrato');
    }
    throw new BadRequestException('Utente gia registrato');
  }

  private randomPasswordPlaceholder(): string {
    return `Tmp${Math.random().toString(36).slice(2, 10)}!`;
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private validateItalianMobilePhone(phone?: string): void {
    if (!phone) {
      return;
    }

    if (!/^3[0-9]{8,9}$/.test(phone)) {
      throw new BadRequestException('Cellulare italiano non valido: inserisci 9 o 10 cifre senza prefisso');
    }
  }

  private validateTaxCode(taxCode?: string): void {
    if (!taxCode) {
      return;
    }

    const value = taxCode.toUpperCase();
    if (!/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(value)) {
      throw new BadRequestException('Codice fiscale non valido');
    }

    const oddMap: Record<string, number> = {
      '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
      A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
      N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
    };
    const evenMap: Record<string, number> = {
      '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
      N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
    };
    const checkChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const sum = value.slice(0, 15).split('').reduce((total, char, index) => {
      return total + ((index + 1) % 2 === 1 ? oddMap[char] : evenMap[char]);
    }, 0);

    if (checkChars[sum % 26] !== value[15]) {
      throw new BadRequestException('Codice fiscale non valido');
    }
  }

}
