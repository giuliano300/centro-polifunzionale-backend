import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { FilterQuery, Model, Types } from 'mongoose';
import { Booking, BookingDocument } from '../schemas/booking.schema';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { UpdateBookingDto } from '../dto/update-booking.dto';
import { FilterBookingsDto } from 'src/filters/filter-bookings.dto';
import { Payment, PaymentDocument } from 'src/schemas/payment.schema';
import { BookingWithPayments } from 'src/interfaces/BookingWithPayments';
import { Space, SpaceDocument } from 'src/schemas/space.schema';
import { User, UserDocument } from 'src/schemas/user.schema';
import { WalletService } from './wallet.service';
import { NotificationsService } from './notifications.service';
import { DiscountCodeService } from './discount-code.service';
import { SystemSettingsService } from './system-settings.service';

type SearchableBooking = BookingDocument & {
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    taxCode?: string;
  };
  space?: {
    name?: string;
  };
};

type PaginatedBookings = {
  items: BookingWithPayments[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Space.name) private spaceModel: Model<SpaceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
    private discountCodeService: DiscountCodeService,
    private systemSettingsService: SystemSettingsService,
  ) {}

  async create(createBookingDto: CreateBookingDto, userId: string, idempotencyKey?: string): Promise<Booking> {
    const targetUserId = createBookingDto.userId || userId;
    await this.expirePendingBookings();
    const normalizedKey = idempotencyKey?.trim().slice(0, 200);
    if (normalizedKey) {
      const replay = await this.bookingModel.findOne({ user: new Types.ObjectId(targetUserId), idempotencyKey: normalizedKey }).exec();
      if (replay) return replay;
    }

    const semanticReplay = await this.bookingModel.findOne({
      user: new Types.ObjectId(targetUserId),
      space: new Types.ObjectId(createBookingDto.spaceId),
      date: new Date(createBookingDto.date),
      startTime: createBookingDto.startTime,
      endTime: createBookingDto.endTime,
      status: { $in: ['pending', 'confirmed'] },
      $or: [{ status: 'confirmed' }, { holdExpiresAt: { $gt: new Date() } }],
    }).exec();
    if (semanticReplay) return semanticReplay;

    const space = await this.spaceModel.findById(createBookingDto.spaceId).exec();
    if (!space) {
      throw new NotFoundException('Spazio non trovato');
    }

    this.validateSpaceAvailability(space, createBookingDto);
    await this.validateBookingConflicts(space, createBookingDto);
    const user = await this.userModel.findById(targetUserId).exec();
    const monthlyPurchaseCount = await this.monthlyBookingPurchaseCount(targetUserId, createBookingDto.date);
    const originalAmount = this.calculateAmount(space, createBookingDto);
    const discount = await this.discountCodeService.apply(
      createBookingDto.discountCode,
      'booking',
      originalAmount,
      (space._id as Types.ObjectId).toString(),
      createBookingDto.date,
      { role: user?.role, createdAt: (user as unknown as { createdAt?: Date })?.createdAt, monthlyPurchaseCount },
    );
    const amount = Math.max(originalAmount - discount.amount, 0);

    const holdMinutes = await this.systemSettingsService.bookingHoldMinutes();
    const booking = new this.bookingModel({
      ...createBookingDto,
      user: new mongoose.Types.ObjectId(targetUserId),
      space: new mongoose.Types.ObjectId(createBookingDto.spaceId),
      rentalUnit: createBookingDto.rentalUnit || space.rentalUnit || 'whole_room',
      rentalMode: createBookingDto.rentalMode || 'time',
      workstationQuantity: createBookingDto.workstationQuantity || 1,
      sectorQuantity: this.getSectorQuantity(space, createBookingDto),
      sectorIndexes: this.getSectorIndexes(space, createBookingDto),
      holdExpiresAt: new Date(Date.now() + holdMinutes * 60_000),
      idempotencyKey: normalizedKey,
    });
    const savedBooking = await booking.save();

    await this.walletService.withUserWalletLock(targetUserId, async () => {
      const walletBalance = Math.max(await this.walletService.balance(targetUserId), 0);
      const walletAmount = Math.min(walletBalance, amount);
      const externalAmount = Math.max(amount - walletAmount, 0);

      if (walletAmount > 0) {
        await this.walletService.debitBookingPayment(
          targetUserId,
          (savedBooking._id as Types.ObjectId).toString(),
          walletAmount,
          `Utilizzo wallet per prenotazione ${savedBooking.name || savedBooking._id}`,
        );
      }

      await this.paymentModel.create({
        bookingId: savedBooking._id,
        amount: externalAmount,
        totalAmount: amount,
        walletAmount,
        externalAmount,
        originalAmount,
        discountAmount: discount.amount,
        discountCode: discount.code,
        status: externalAmount <= 0 ? 'PAID' : 'PENDING',
        method: externalAmount <= 0 ? 'wallet' : 'manual',
        provider: 'manual',
        transactionId: externalAmount <= 0 ? `WALLET-${Date.now()}` : undefined,
      });
      if (externalAmount <= 0) {
        savedBooking.status = 'confirmed';
        savedBooking.holdExpiresAt = undefined;
        await savedBooking.save();
      }
    });
    await this.discountCodeService.markUsed(discount.code);
    const manager = await this.userModel.findById(targetUserId).exec();
    await this.notificationsService.create({
      audience: 'admin',
      title: 'Nuovo acquisto spazio',
      message: `${manager?.name || manager?.email || 'Gestore'} ha acquistato ${space.name} per il ${this.formatNotificationDate(savedBooking.date)}.`,
      type: 'booking_created',
      link: this.monthLink('/bookings', savedBooking.date),
    });
    return savedBooking;
  }

  async availability(spaceId: string, date: string, rentalMode = 'time', workstationQuantity = 1, sectorQuantity = 0, sectorIndexes: number[] = []) {
    await this.expirePendingBookings();
    const space = await this.spaceModel.findById(spaceId).exec();
    if (!space) {
      throw new NotFoundException('Spazio non trovato');
    }

    const configuredModes = space.rentalModes?.length ? space.rentalModes : ['time'];
    const bookingDate = new Date(date);
    const slot = (space.openingHours?.length ? space.openingHours : this.defaultOpeningHours())
      .find((item) => item.day === bookingDate.getDay());
    const closure = this.getExceptionalClosure(space, bookingDate);

    if (closure || !space.isAvailable || !slot?.isOpen || !configuredModes.includes(rentalMode as 'time' | 'full_day')) {
      return {
        spaceId,
        date,
        rentalMode,
        isOpen: false,
        closureReason: closure?.reason || '',
        maxConsecutiveTimeSlots: this.getMaxConsecutiveTimeSlots(space, slot),
        slots: [],
      };
    }

    const open = this.timeToMinutes(slot.openTime);
    const close = this.timeToMinutes(slot.closeTime);
    const normalizedClose = close <= open ? close + 1440 : close;

    if (rentalMode === 'full_day') {
      const dto = {
        spaceId,
        date,
        name: 'Disponibilita giornata',
        startTime: slot.openTime,
        endTime: slot.closeTime,
        rentalMode: 'full_day' as const,
        rentalUnit: space.rentalUnit || 'whole_room',
        workstationQuantity,
        sectorQuantity,
        sectorIndexes,
      };
      const available = this.isStartBookableToday(space, dto, open, normalizedClose)
        && await this.isAvailableForDto(space, dto);
      return {
        spaceId,
        date,
        rentalMode,
        isOpen: true,
        maxConsecutiveTimeSlots: this.getMaxConsecutiveTimeSlots(space, slot),
        slots: available ? [{
          startTime: slot.openTime,
          endTime: slot.closeTime,
          amount: this.calculateAmount(space, dto),
          available: true,
        }] : [],
      };
    }

    const step = space.timeSlotMinutes || 60;
    const slots: Array<{ startTime: string; endTime: string; amount: number; available: boolean }> = [];
    for (let start = open; start + step <= normalizedClose; start += step) {
      const end = start + step;
      const dto = {
        spaceId,
        date,
        name: 'Disponibilita frazione',
        startTime: this.minutesToTime(start),
        endTime: this.minutesToTime(end),
        rentalMode: 'time' as const,
        rentalUnit: space.rentalUnit || 'whole_room',
        workstationQuantity,
        sectorQuantity,
        sectorIndexes,
      };
      if (!this.isStartBookableToday(space, dto, open, normalizedClose)) {
        continue;
      }

      slots.push({
        startTime: dto.startTime,
        endTime: dto.endTime,
        amount: this.calculateAmount(space, dto),
        available: await this.isAvailableForDto(space, dto),
      });
    }

    return {
      spaceId,
      date,
      rentalMode,
      isOpen: true,
      maxConsecutiveTimeSlots: this.getMaxConsecutiveTimeSlots(space, slot),
      slots,
    };
  }

  private async isAvailableForDto(space: SpaceDocument, dto: CreateBookingDto): Promise<boolean> {
    try {
      this.validateSpaceAvailability(space, dto);
      await this.validateBookingConflicts(space, dto);
      return true;
    } catch {
      return false;
    }
  }

  private validateSpaceAvailability(space: SpaceDocument, dto: CreateBookingDto): void {
    if (!space.isAvailable) {
      throw new BadRequestException('Spazio non disponibile');
    }

    const configuredRentalUnit = space.rentalUnit || 'whole_room';
    const configuredRentalModes = space.rentalModes?.length ? space.rentalModes : ['time'];
    const rentalUnit = dto.rentalUnit || configuredRentalUnit;
    const rentalMode = dto.rentalMode || 'time';

    if (rentalUnit !== configuredRentalUnit) {
      throw new BadRequestException('Tipo di acquisto non compatibile con lo spazio');
    }

    if (!configuredRentalModes.includes(rentalMode)) {
      throw new BadRequestException('Modalita di acquisto non consentita per questo spazio');
    }

    if (rentalUnit === 'workstation' && (dto.workstationQuantity || 1) > (space.workstationCount || 1)) {
      throw new BadRequestException('Postazioni richieste superiori alle postazioni disponibili');
    }

    if (rentalUnit === 'whole_room') {
      const sectorQuantity = this.getSectorQuantity(space, dto);
      if (sectorQuantity > this.getSectorCapacity(space)) {
        throw new BadRequestException('Aree richiesti superiori ai aree disponibili');
      }
    }

    const slot = this.getOpeningSlot(space, dto.date);
    if (!slot || !slot.isOpen) {
      throw new BadRequestException('Spazio chiuso nel giorno selezionato');
    }

    if (this.getExceptionalClosure(space, dto.date)) {
      throw new BadRequestException('Spazio chiuso per evento eccezionale nel giorno selezionato');
    }

    const open = this.timeToMinutes(slot.openTime);
    const close = this.timeToMinutes(slot.closeTime);
    const normalizedClose = close <= open ? close + 1440 : close;
    const { start: normalizedStart, end: normalizedEnd } = this.getNormalizedInterval(space, dto);

    if (rentalMode === 'full_day') {
      if (normalizedStart !== open || normalizedEnd !== normalizedClose) {
        throw new BadRequestException('La giornata intera deve coincidere con orario di apertura e chiusura dello spazio');
      }
      if (!this.isStartBookableToday(space, dto, open, normalizedClose)) {
        throw new BadRequestException('Puoi prenotare solo dalla prossima frazione disponibile');
      }
      return;
    }

    if (normalizedStart < open || normalizedEnd > normalizedClose || normalizedEnd <= normalizedStart) {
      throw new BadRequestException('Orario fuori dalla disponibilita dello spazio');
    }

    const slotMinutes = space.timeSlotMinutes || 60;
    if ((normalizedStart - open) % slotMinutes !== 0 || (normalizedEnd - normalizedStart) % slotMinutes !== 0) {
      throw new BadRequestException(`Questo spazio si prenota a frazioni di ${slotMinutes} minuti`);
    }

    const requestedSlots = Math.ceil((normalizedEnd - normalizedStart) / slotMinutes);
    const maxConsecutiveTimeSlots = this.getMaxConsecutiveTimeSlots(space, slot);
    if (requestedSlots > maxConsecutiveTimeSlots) {
      throw new BadRequestException(`Puoi acquistare al massimo ${maxConsecutiveTimeSlots} fasce orarie consecutive per questo spazio`);
    }

    if (!this.isStartBookableToday(space, dto, open, normalizedClose)) {
      throw new BadRequestException('Puoi prenotare solo dalla prossima frazione disponibile');
    }
  }

  private isStartBookableToday(
    space: SpaceDocument,
    dto: Pick<CreateBookingDto, 'date' | 'startTime' | 'endTime' | 'rentalMode'>,
    open: number,
    normalizedClose: number,
  ): boolean {
    if (!this.isToday(dto.date)) {
      return true;
    }

    const now = new Date();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const normalizedNow = normalizedClose > 1440 && currentMinutes < open
      ? currentMinutes + 1440
      : currentMinutes;

    const { start } = this.getNormalizedInterval(space, dto);

    if ((dto.rentalMode || 'time') === 'full_day') {
      return normalizedNow < open;
    }

    const slotMinutes = space.timeSlotMinutes || 60;
    const elapsed = Math.max(0, normalizedNow - open);
    const nextBookableStart = normalizedNow < open
      ? open
      : open + (Math.floor(elapsed / slotMinutes) + 1) * slotMinutes;

    return start >= nextBookableStart && start < normalizedClose;
  }

  private async validateBookingConflicts(space: SpaceDocument, dto: CreateBookingDto): Promise<void> {
    const requested = this.getNormalizedInterval(space, dto);
    const rentalUnit = dto.rentalUnit || space.rentalUnit || 'whole_room';
    const workstationQuantity = dto.workstationQuantity || 1;
    const requestedSectorIndexes = this.getSectorIndexes(space, dto);
    const requestedSectorQuantity = requestedSectorIndexes.length || this.getSectorQuantity(space, dto);
    const sectorCapacity = this.getSectorCapacity(space);

    const sameDayBookings = await this.bookingModel.find({
      space: new mongoose.Types.ObjectId(dto.spaceId),
      date: new Date(dto.date),
      $or: [
        { status: { $in: ['confirmed', 'cancellation_requested'] } },
        { status: 'pending', holdExpiresAt: { $gt: new Date() } },
      ],
    }).exec();

    const overlapping = sameDayBookings.filter((booking) => {
      const current = this.getNormalizedInterval(space, {
        ...dto,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
      return requested.start < current.end && requested.end > current.start;
    });

    if (!overlapping.length) {
      return;
    }

    if (rentalUnit === 'whole_room') {
      if (space.sectorEnabled && requestedSectorIndexes.length) {
        const requestedAll = requestedSectorIndexes.length >= sectorCapacity;
        const conflict = overlapping.some((booking) => {
          const bookedIndexes = this.getBookedSectorIndexes(space, booking);
          return requestedAll
            || bookedIndexes.length >= sectorCapacity
            || requestedSectorIndexes.some((index) => bookedIndexes.includes(index));
        });
        if (conflict) {
          throw new BadRequestException('Aree non disponibili in questa fascia oraria');
        }
        return;
      }

      const usedSectors = overlapping.reduce((total, booking) => total + this.getBookedSectorQuantity(space, booking), 0);
      if (usedSectors + requestedSectorQuantity > sectorCapacity) {
        throw new BadRequestException('Aree non disponibili in questa fascia oraria');
      }
      return;
    }

    if (overlapping.some((booking) => booking.rentalUnit === 'whole_room')) {
      throw new BadRequestException('Lo spazio e gia prenotato in questa fascia oraria');
    }

    const usedWorkstations = overlapping.reduce((total, booking) => total + (booking.workstationQuantity || 1), 0);
    if (usedWorkstations + workstationQuantity > (space.workstationCount || 1)) {
      throw new BadRequestException('Postazioni non disponibili in questa fascia oraria');
    }
  }

  private async expirePendingBookings(): Promise<void> {
    const expired = await this.bookingModel.find({
      status: 'pending',
      holdExpiresAt: { $lte: new Date() },
    }).exec();

    for (const booking of expired) {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const payment = await this.paymentModel.findOne({ bookingId: booking._id, status: 'PENDING' }).exec();
      const updated = await this.bookingModel.findOneAndUpdate(
        { _id: booking._id, status: 'pending' },
        { $set: { status: 'expired' } },
        { new: true },
      ).exec();
      if (!updated) continue;
      if ((payment?.walletAmount || 0) > 0) {
        await this.walletService.releaseBookingHold(booking.user.toString(), bookingId, payment!.walletAmount);
      }
      await this.discountCodeService.releaseUsed(payment?.discountCode);
      await this.paymentModel.updateMany(
        { bookingId: booking._id, status: 'PENDING' },
        { $set: { status: 'FAILED', method: 'hold_expired' } },
      ).exec();
    }
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours * 60) + minutes;
  }

  private minutesToTime(value: number): string {
    const normalized = ((value % 1440) + 1440) % 1440;
    const hours = Math.floor(normalized / 60).toString().padStart(2, '0');
    const minutes = (normalized % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private getOpeningSlot(space: SpaceDocument, date: string | Date) {
    const bookingDate = new Date(date);
    const openingHours = space.openingHours?.length ? space.openingHours : this.defaultOpeningHours();
    return openingHours.find((item) => item.day === bookingDate.getDay());
  }

  private getMaxConsecutiveTimeSlots(space: SpaceDocument, slot?: { maxConsecutiveTimeSlots?: number } | null): number {
    return Math.max(Number(slot?.maxConsecutiveTimeSlots || space.maxConsecutiveTimeSlots || 1), 1);
  }

  private getExceptionalClosure(space: SpaceDocument, date: string | Date) {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    return (space.exceptionalClosures || []).find((closure) => {
      const start = new Date(closure.startDate);
      const end = new Date(closure.endDate || closure.startDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return target >= start && target <= end;
    });
  }

  private isToday(value: string | Date): boolean {
    const date = new Date(value);
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  private isAfterToday(value: string | Date): boolean {
    const date = new Date(value);
    const today = new Date();
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return date.getTime() > today.getTime();
  }

  private formatNotificationDate(value: string | Date): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  private getNormalizedInterval(space: SpaceDocument, dto: Pick<CreateBookingDto, 'date' | 'startTime' | 'endTime'>): { start: number; end: number } {
    const slot = this.getOpeningSlot(space, dto.date);
    const open = this.timeToMinutes(slot?.openTime || '00:00');
    const close = this.timeToMinutes(slot?.closeTime || '23:59');
    const crossesMidnight = close <= open;
    const startRaw = this.timeToMinutes(dto.startTime);
    const endRaw = this.timeToMinutes(dto.endTime);
    const start = crossesMidnight && startRaw < open ? startRaw + 1440 : startRaw;
    let end = crossesMidnight && endRaw <= open ? endRaw + 1440 : endRaw;

    if (end <= start) {
      end += 1440;
    }

    return { start, end };
  }

  private calculateAmount(space: SpaceDocument, dto: CreateBookingDto): number {
    if ((dto.rentalMode || 'time') === 'full_day') {
      if ((dto.rentalUnit || space.rentalUnit) === 'whole_room') {
        const sectorQuantity = this.getSectorQuantity(space, dto);
        const sectorCapacity = this.getSectorCapacity(space);
        if (space.sectorEnabled && sectorQuantity < sectorCapacity) {
          return (space.sectorDailyRate || space.dailyRate || 0) * sectorQuantity;
        }
      }
      return space.dailyRate || 0;
    }

    const { start, end } = this.getNormalizedInterval(space, dto);
    const fraction = space.timeSlotMinutes || 60;
    const units = Math.ceil((end - start) / fraction);
    if ((dto.rentalUnit || space.rentalUnit) === 'workstation') {
      return units * (space.hourlyRate || 0) * (dto.workstationQuantity || 1);
    }

    const sectorQuantity = this.getSectorQuantity(space, dto);
    const sectorCapacity = this.getSectorCapacity(space);
    if (space.sectorEnabled && sectorQuantity < sectorCapacity) {
      return units * (space.sectorRate || space.hourlyRate || 0) * sectorQuantity;
    }

    return units * (space.hourlyRate || 0);
  }

  private getSectorCapacity(space: SpaceDocument): number {
    return space.rentalUnit === 'whole_room' && space.sectorEnabled
      ? Math.max(Number(space.sectorCount || 1), 1)
      : 1;
  }

  private getSectorQuantity(space: SpaceDocument, dto: Pick<CreateBookingDto, 'sectorQuantity'>): number {
    if (space.rentalUnit !== 'whole_room' || !space.sectorEnabled) {
      return 1;
    }

    return Math.max(Number(dto.sectorQuantity || space.sectorCount || 1), 1);
  }

  private getSectorIndexes(space: SpaceDocument, dto: Pick<CreateBookingDto, 'sectorIndexes' | 'sectorQuantity'>): number[] {
    const capacity = this.getSectorCapacity(space);
    if (space.rentalUnit !== 'whole_room' || !space.sectorEnabled || capacity <= 1) {
      return [];
    }

    const raw = Array.isArray(dto.sectorIndexes) ? dto.sectorIndexes : [];
    const indexes = [...new Set(raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value < capacity))];
    if (indexes.length) {
      return indexes.sort((a, b) => a - b);
    }

    const quantity = Math.min(this.getSectorQuantity(space, dto), capacity);
    return Array.from({ length: quantity }, (_, index) => index);
  }

  private getBookedSectorQuantity(space: SpaceDocument, booking: Pick<BookingDocument, 'rentalUnit' | 'sectorQuantity' | 'sectorIndexes'>): number {
    if (booking.rentalUnit !== 'whole_room') {
      return 0;
    }

    if (!space.sectorEnabled) {
      return 1;
    }

    return this.getBookedSectorIndexes(space, booking).length || Math.max(Number(booking.sectorQuantity || space.sectorCount || 1), 1);
  }

  private getBookedSectorIndexes(space: SpaceDocument, booking: Pick<BookingDocument, 'rentalUnit' | 'sectorQuantity' | 'sectorIndexes'>): number[] {
    const capacity = this.getSectorCapacity(space);
    if (booking.rentalUnit !== 'whole_room') {
      return [];
    }

    if (!space.sectorEnabled) {
      return [0];
    }

    const raw = Array.isArray(booking.sectorIndexes) ? booking.sectorIndexes : [];
    const indexes = [...new Set(raw.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value < capacity))];
    if (indexes.length) {
      return indexes.sort((a, b) => a - b);
    }

    const quantity = Math.min(Math.max(Number(booking.sectorQuantity || space.sectorCount || 1), 1), capacity);
    return Array.from({ length: quantity }, (_, index) => index);
  }

  private defaultOpeningHours() {
    return [
      { day: 0, isOpen: false, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 6, isOpen: false, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
    ];
  }

  private async monthlyBookingPurchaseCount(userId: string, date: string | Date): Promise<number> {
    const target = new Date(date);
    const start = new Date(target.getFullYear(), target.getMonth(), 1);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    return this.bookingModel.countDocuments({
      user: new Types.ObjectId(userId),
      date: { $gte: start, $lt: end },
      status: { $in: ['confirmed', 'pending'] },
    }).exec();
  }

  async findAll(filterDto: FilterBookingsDto): Promise<BookingWithPayments[] | PaginatedBookings> {
    await this.expirePendingBookings();
    const { spaceId, userId, date, status, excludeStatus, start, end, search, page, limit } = filterDto;

    const query: FilterQuery<Booking> = {};

    if (spaceId) query.space = new Types.ObjectId(spaceId);
    if (userId) query.user = new Types.ObjectId(userId);
    if (date) query.date = date;

    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = new Date(start);
      if (end) query.date.$lt = new Date(end);
    }

    if (status) {
      query.status = status;
    } else if (excludeStatus) {
      query.status = { $ne: excludeStatus };
    }

    const bookings = await this.bookingModel
      .find(query)
      .sort({ date: -1, startTime: -1, _id: -1 })
      .populate('user')
      .populate('space')
      .exec();

    const normalizedSearch = search?.trim().toLowerCase();
    const filteredBookings = normalizedSearch
      ? (bookings as SearchableBooking[]).filter((booking) => {
        const text = [
          booking.name,
          booking.status,
          booking.user?.name,
          booking.user?.email,
          booking.user?.phone,
          booking.user?.taxCode,
          booking.space?.name,
        ].join(' ').toLowerCase();
        return text.includes(normalizedSearch);
      })
      : bookings;

    const shouldPaginate = !!page || !!limit;
    const pageNumber = Math.max(Number(page || 1), 1);
    const limitNumber = Math.min(Math.max(Number(limit || 10), 1), 100);
    const paginatedBookings = shouldPaginate
      ? filteredBookings.slice((pageNumber - 1) * limitNumber, pageNumber * limitNumber)
      : filteredBookings;

    const bookingsWithPayments: BookingWithPayments[] = await Promise.all(
      paginatedBookings.map(async (booking) => {
        const payments = await this.paymentModel.find({ bookingId: booking._id }).exec();
        const cancellationRefundAmount = await this.walletService.cancellationRefundAmountByBooking(
          (booking._id as Types.ObjectId).toString(),
        );
        return { booking, payments, cancellationRefundAmount };
      }),
    );

    if (shouldPaginate) {
      return {
        items: bookingsWithPayments,
        total: filteredBookings.length,
        page: pageNumber,
        limit: limitNumber,
      };
    }

    return bookingsWithPayments;
  }

  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.find({ user: userId }).sort({ date: -1, startTime: -1, _id: -1 }).populate('space').exec();
  }

  async findBySpace(spaceId: string): Promise<Booking[]> {
    return this.bookingModel.find({ space: spaceId }).sort({ date: -1, startTime: -1, _id: -1 }).populate('user').exec();
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id).populate('user').populate('space').exec();
    if (!booking) {
      throw new NotFoundException(`Booking #${id} not found`);
    }
    return booking;
  }

  async update(id: string, updateBookingDto: UpdateBookingDto): Promise<Booking> {
    const updated = await this.bookingModel.findByIdAndUpdate(id, updateBookingDto, { new: true }).exec();
    if (!updated) {
      throw new NotFoundException(`Booking #${id} not found`);
    }
    return updated;
  }

  async requestCancellation(id: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) {
      throw new NotFoundException(`Booking #${id} not found`);
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException("La prenotazione è già annullata");
    }

    if (booking.status === 'cancellation_requested') {
      throw new BadRequestException("La richiesta di annullamento è già stata inviata");
    }

    if (!this.isAfterToday(booking.date)) {
      throw new BadRequestException("Puoi chiedere l'annullamento solo per prenotazioni future, da domani in poi");
    }

    booking.status = 'cancellation_requested';
    const savedBooking = await booking.save();
    const populatedBooking = await this.bookingModel.findById(savedBooking._id).populate('user').populate('space').exec();
    const manager = populatedBooking?.user as unknown as { name?: string; email?: string } | undefined;
    const space = populatedBooking?.space as unknown as { name?: string } | undefined;
    await this.notificationsService.create({
      audience: 'admin',
      title: 'Richiesta annullamento',
      message: `${manager?.name || manager?.email || 'Gestore'} ha richiesto l'annullamento di ${space?.name || 'uno spazio'} del ${this.formatNotificationDate(savedBooking.date)}.`,
      type: 'booking_cancellation_requested',
      link: '/cancellation-requests',
    });
    return savedBooking;
  }

  async approveCancellation(id: string, walletCreditAmount: number): Promise<Booking> {
    const booking = await this.bookingModel.findById(id).populate('user').populate('space').exec();
    if (!booking) {
      throw new NotFoundException(`Booking #${id} not found`);
    }

    if (booking.status !== 'cancellation_requested') {
      throw new BadRequestException('La prenotazione non ha una richiesta di annullamento aperta');
    }

    const paidPayment = await this.paymentModel.findOne({ bookingId: booking._id, status: 'PAID' }).exec();
    const fallbackPayment = await this.paymentModel.findOne({ bookingId: booking._id }).sort({ createdAt: 1 }).exec();
    const paidAmount = paidPayment?.totalAmount || paidPayment?.amount || fallbackPayment?.totalAmount || fallbackPayment?.amount || 0;
    const creditAmount = Number(walletCreditAmount || 0);

    if (creditAmount < 0) {
      throw new BadRequestException('Il credito wallet non può essere negativo');
    }

    if (creditAmount > paidAmount) {
      throw new BadRequestException("Il credito wallet non può superare l'importo pagato");
    }

    const bookingUser = booking.user as unknown as { _id?: { toString(): string }; toString(): string };
    const userId = bookingUser._id?.toString() || bookingUser.toString();
    const bookingId = (booking._id as Types.ObjectId).toString();
    await this.walletService.creditCancellationRefund(
      userId,
      bookingId,
      creditAmount,
      `Credito da annullamento prenotazione ${booking.name || booking._id}`,
    );

    booking.status = 'cancelled';
    return booking.save();
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const booking = await this.bookingModel.findById(id).populate('user').populate('space').exec();
    if (!booking) {
      throw new NotFoundException(`Booking #${id} not found`);
    }

    if (booking.status !== 'cancelled') {
      const paidPayment = await this.paymentModel.findOne({ bookingId: booking._id, status: 'PAID' }).exec();
      const paidAmount = Number(paidPayment?.totalAmount || paidPayment?.amount || 0);
      const bookingUser = booking.user as unknown as { _id?: { toString(): string }; email?: string; name?: string; toString(): string };
      const userId = bookingUser._id?.toString() || bookingUser.toString();
      if (paidAmount > 0) {
        await this.walletService.creditCancellationRefund(
          userId,
          (booking._id as Types.ObjectId).toString(),
          paidAmount,
          `Rimborso annullamento prenotazione ${booking.name || booking._id}`,
        );
      }

      booking.status = 'cancelled';
      await booking.save();
      const space = booking.space as unknown as { name?: string } | undefined;
      await this.notificationsService.create({
        audience: 'gestore',
        userId,
        title: 'Prenotazione annullata',
        message: paidAmount > 0
          ? `La prenotazione ${space?.name || booking.name || 'spazio'} del ${this.formatNotificationDate(booking.date)} e stata annullata. Il rimborso e stato accreditato nel wallet.`
          : `La prenotazione ${space?.name || booking.name || 'spazio'} del ${this.formatNotificationDate(booking.date)} e stata annullata.`,
        type: 'booking_cancelled',
        link: '/bookings',
      });
    }
    return { deleted: true };
  }

  private monthLink(basePath: string, value: string | Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return basePath;
    }

    return `${basePath}?month=${date.getMonth() + 1}&year=${date.getFullYear()}`;
  }
}
