import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { CreateUserDto } from '../dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from 'src/dto/update-user.dto';
import { GetUsersFilterDto } from 'src/filters/get-user-filters.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const normalizedUser = this.normalizeOptionalIdentityFields(createUserDto);
    this.validateTaxCode(normalizedUser.taxCode);
    const createdUser = new this.userModel({
      ...normalizedUser,
      password: hashedPassword,
      role: normalizedUser.role || 'cliente'
    });
    return createdUser.save();  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userModel.findOne({ email }).exec();
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
    const { email, role, excludeRole, search, limit = 10, page = 1, sortBy = 'email', sortOrder = 'asc' } = filterDto;

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
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const current = await this.findById(id);
    if (current.role === 'admin' && dto.isActive === false) {
      throw new BadRequestException('Non puoi disattivare un amministratore');
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    const normalizedDto = this.normalizeOptionalIdentityFields(dto);
    this.validateTaxCode(normalizedDto.taxCode);

    const updated = await this.userModel.findByIdAndUpdate(id, normalizedDto, {
      new: true,
      runValidators: true,
    }).exec();

    if (!updated) {
      throw new NotFoundException('Utente non trovato');
    }

    return updated;
  }
  // users.service.ts
  async remove(id: string): Promise<{ deleted: boolean }> {
    const current = await this.findById(id);
    if (current.role === 'admin') {
      throw new BadRequestException('Non puoi eliminare un amministratore');
    }

    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException('Utente non trovato');
    }
    return { deleted: true };
  }

  private normalizeOptionalIdentityFields<T extends { phone?: string; taxCode?: string }>(dto: T): T {
    const normalized = { ...dto };
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
