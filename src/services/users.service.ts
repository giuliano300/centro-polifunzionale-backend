import { Injectable, NotFoundException } from '@nestjs/common';
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
    const createdUser = new this.userModel({
      ...normalizedUser,
      password: hashedPassword,
      role: normalizedUser.role || 'cliente'
    });
    return createdUser.save();  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userModel.findOne({ email }).exec();
  }

  async findAll(filterDto: GetUsersFilterDto): Promise<User[]> {
    const { email, role, search, limit = 10, page = 1, sortBy = 'email', sortOrder = 'asc' } = filterDto;

    const filter: Record<string, unknown> = {};    
    if (email) filter.email = email;
    if (role) filter.role = role;
    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
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
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }
    const normalizedDto = this.normalizeOptionalIdentityFields(dto);

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

}
