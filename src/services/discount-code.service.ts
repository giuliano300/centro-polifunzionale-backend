import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import { DiscountCode, DiscountCodeDocument } from 'src/schemas/discount-code.schema';
import { CreateDiscountCodeDto, UpdateDiscountCodeDto } from 'src/dto/discount-code.dto';

@Injectable()
export class DiscountCodeService {
  constructor(
    @InjectModel(DiscountCode.name) private discountModel: Model<DiscountCodeDocument>,
  ) {}

  findAll(): Promise<DiscountCode[]> {
    return this.discountModel.find().sort({ createdAt: -1, _id: -1 }).exec();
  }

  async create(dto: CreateDiscountCodeDto): Promise<DiscountCode> {
    const normalized = this.normalize(dto);
    const existing = await this.discountModel.findOne({ code: normalized.code }).exec();
    if (existing) {
      throw new BadRequestException('Codice sconto gia presente');
    }
    return this.discountModel.create(normalized);
  }

  async update(id: string, dto: UpdateDiscountCodeDto): Promise<DiscountCode> {
    const updated = await this.discountModel.findByIdAndUpdate(id, this.normalize(dto), { new: true, runValidators: true }).exec();
    if (!updated) {
      throw new NotFoundException('Codice sconto non trovato');
    }
    return updated;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.discountModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Codice sconto non trovato');
    }
    return { deleted: true };
  }

  async apply(
    code: string | undefined,
    target: 'booking' | 'course',
    amount: number,
    spaceId?: string,
    operationDate?: string | Date,
    userContext?: { role?: string; createdAt?: Date | string; monthlyPurchaseCount?: number },
  ): Promise<{ code?: string; amount: number }> {
    const normalizedCode = code?.trim().toUpperCase();
    if (amount <= 0) {
      return { amount: 0 };
    }

    const discount = normalizedCode
      ? await this.discountModel.findOne({ code: normalizedCode }).exec()
      : await this.bestAutomaticDiscount(target, amount, spaceId, operationDate, userContext);

    if (!normalizedCode && !discount) {
      return { amount: 0 };
    }

    if (!discount || !discount.isActive) {
      throw new BadRequestException('Codice sconto non valido');
    }

    if (discount.target !== 'all' && discount.target !== target) {
      throw new BadRequestException('Codice sconto non valido per questa operazione');
    }

    if (discount.spaces?.length && !discount.spaces.some((space) => space.toString() === spaceId)) {
      throw new BadRequestException('Codice sconto non valido per questo spazio');
    }

    if (discount.userRoles?.length && (!userContext?.role || !discount.userRoles.includes(userContext.role))) {
      throw new BadRequestException('Codice sconto non valido per questo tipo di utente');
    }

    if (discount.rule === 'new_user') {
      const createdAt = userContext?.createdAt ? new Date(userContext.createdAt) : null;
      const maxAgeMs = Math.max(Number(discount.newUserDays || 30), 1) * 24 * 60 * 60 * 1000;
      if (!createdAt || Date.now() - createdAt.getTime() > maxAgeMs) {
        throw new BadRequestException('Codice sconto riservato ai nuovi registrati');
      }
    }

    if (discount.rule === 'monthly_purchases' && Number(userContext?.monthlyPurchaseCount || 0) < Number(discount.monthlyPurchaseMin || 0)) {
      throw new BadRequestException('Codice sconto riservato a chi ha raggiunto gli acquisti mensili richiesti');
    }

    const targetDate = operationDate ? new Date(operationDate) : new Date();
    if (discount.validFrom && discount.validFrom > targetDate) {
      throw new BadRequestException('Codice sconto non valido per questa data');
    }
    if (discount.validTo && discount.validTo < targetDate) {
      throw new BadRequestException('Codice sconto non valido per questa data');
    }
    if (discount.maxUses && discount.usedCount >= discount.maxUses) {
      throw new BadRequestException('Codice sconto esaurito');
    }

    const rawDiscount = discount.type === 'percentage'
      ? amount * (discount.value / 100)
      : discount.value;
    return {
      code: discount.code,
      amount: Math.min(Math.max(Number(rawDiscount.toFixed(2)), 0), amount),
    };
  }

  async markUsed(code?: string): Promise<void> {
    if (!code) {
      return;
    }
    await this.discountModel.updateOne({ code: code.trim().toUpperCase() }, { $inc: { usedCount: 1 } }).exec();
  }

  private normalize(dto: CreateDiscountCodeDto | UpdateDiscountCodeDto): Partial<DiscountCode> {
    const isAutomatic = dto.isAutomatic === true;
    if (!isAutomatic && !dto.code?.trim()) {
      throw new BadRequestException('Inserisci un codice per le promo non automatiche');
    }
    const code = dto.code?.trim().toUpperCase() || this.generateAutomaticCode();
    return {
      ...dto,
      code,
      title: dto.title?.trim(),
      description: dto.description?.trim(),
      isAutomatic,
      target: dto.target || 'all',
      spaces: dto.spaceIds?.length ? dto.spaceIds.map((id) => new Types.ObjectId(id)) : [],
      userRoles: dto.userRoles || [],
      rule: dto.rule || 'manual',
      newUserDays: dto.newUserDays || 30,
      monthlyPurchaseMin: dto.monthlyPurchaseMin || 0,
      isActive: dto.isActive !== false,
      validFrom: dto.validFrom ? this.startOfDay(dto.validFrom) : undefined,
      validTo: dto.validTo ? this.endOfDay(dto.validTo) : undefined,
    };
  }

  private async bestAutomaticDiscount(
    target: 'booking' | 'course',
    amount: number,
    spaceId?: string,
    operationDate?: string | Date,
    userContext?: { role?: string; createdAt?: Date | string; monthlyPurchaseCount?: number },
  ): Promise<DiscountCodeDocument | null> {
    const candidates = await this.discountModel.find({ isAutomatic: true, isActive: true }).exec();
    let best: { discount: DiscountCodeDocument; amount: number } | null = null;

    for (const discount of candidates) {
      const discountAmount = this.safeDiscountAmount(discount, target, amount, spaceId, operationDate, userContext);
      if (discountAmount <= 0) {
        continue;
      }
      if (!best || discountAmount > best.amount) {
        best = { discount, amount: discountAmount };
      }
    }

    return best?.discount || null;
  }

  private safeDiscountAmount(
    discount: DiscountCodeDocument,
    target: 'booking' | 'course',
    amount: number,
    spaceId?: string,
    operationDate?: string | Date,
    userContext?: { role?: string; createdAt?: Date | string; monthlyPurchaseCount?: number },
  ): number {
    try {
      if (discount.target !== 'all' && discount.target !== target) return 0;
      if (discount.spaces?.length && !discount.spaces.some((space) => space.toString() === spaceId)) return 0;
      if (discount.userRoles?.length && (!userContext?.role || !discount.userRoles.includes(userContext.role))) return 0;
      if (discount.rule === 'new_user') {
        const createdAt = userContext?.createdAt ? new Date(userContext.createdAt) : null;
        const maxAgeMs = Math.max(Number(discount.newUserDays || 30), 1) * 24 * 60 * 60 * 1000;
        if (!createdAt || Date.now() - createdAt.getTime() > maxAgeMs) return 0;
      }
      if (discount.rule === 'monthly_purchases' && Number(userContext?.monthlyPurchaseCount || 0) < Number(discount.monthlyPurchaseMin || 0)) return 0;
      const targetDate = operationDate ? new Date(operationDate) : new Date();
      if (discount.validFrom && discount.validFrom > targetDate) return 0;
      if (discount.validTo && discount.validTo < targetDate) return 0;
      if (discount.maxUses && discount.usedCount >= discount.maxUses) return 0;
      const rawDiscount = discount.type === 'percentage' ? amount * (discount.value / 100) : discount.value;
      return Math.min(Math.max(Number(rawDiscount.toFixed(2)), 0), amount);
    } catch {
      return 0;
    }
  }

  private generateAutomaticCode(): string {
    return `PROMO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
  }

  private startOfDay(value: string): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string): Date {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
}
