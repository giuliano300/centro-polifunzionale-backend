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

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(Space.name) private spaceModel: Model<SpaceDocument>,
  ) {}

  async create(createBookingDto: CreateBookingDto, userId: string): Promise<Booking> {
    const space = await this.spaceModel.findById(createBookingDto.spaceId).exec();
    if (!space) {
      throw new NotFoundException('Spazio non trovato');
    }

    this.validateSpaceAvailability(space, createBookingDto);
    await this.validateBookingConflicts(space, createBookingDto);
    const amount = this.calculateAmount(space, createBookingDto);

    const booking = new this.bookingModel({
      ...createBookingDto,
      user: new mongoose.Types.ObjectId(createBookingDto.userId || userId),
      space: new mongoose.Types.ObjectId(createBookingDto.spaceId),
      rentalUnit: createBookingDto.rentalUnit || space.rentalUnit || 'whole_room',
      rentalMode: createBookingDto.rentalMode || 'time',
      workstationQuantity: createBookingDto.workstationQuantity || 1,
    });
    const savedBooking = await booking.save();
    await this.paymentModel.create({
      bookingId: savedBooking._id,
      amount,
      status: 'PENDING',
      method: 'manual',
    });
    return savedBooking;
  }

  async availability(spaceId: string, date: string, rentalMode = 'time', workstationQuantity = 1) {
    const space = await this.spaceModel.findById(spaceId).exec();
    if (!space) {
      throw new NotFoundException('Spazio non trovato');
    }

    const configuredModes = space.rentalModes?.length ? space.rentalModes : ['time'];
    const bookingDate = new Date(date);
    const slot = (space.openingHours?.length ? space.openingHours : this.defaultOpeningHours())
      .find((item) => item.day === bookingDate.getDay());

    if (!space.isAvailable || !slot?.isOpen || !configuredModes.includes(rentalMode as 'time' | 'full_day')) {
      return {
        spaceId,
        date,
        rentalMode,
        isOpen: false,
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
      };
      const available = await this.isAvailableForDto(space, dto);
      return {
        spaceId,
        date,
        rentalMode,
        isOpen: true,
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
      };
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

    const slot = this.getOpeningSlot(space, dto.date);
    if (!slot || !slot.isOpen) {
      throw new BadRequestException('Spazio chiuso nel giorno selezionato');
    }

    const open = this.timeToMinutes(slot.openTime);
    const close = this.timeToMinutes(slot.closeTime);
    const normalizedClose = close <= open ? close + 1440 : close;
    const { start: normalizedStart, end: normalizedEnd } = this.getNormalizedInterval(space, dto);

    if (rentalMode === 'full_day') {
      if (normalizedStart !== open || normalizedEnd !== normalizedClose) {
        throw new BadRequestException('La giornata intera deve coincidere con orario di apertura e chiusura dello spazio');
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
  }

  private async validateBookingConflicts(space: SpaceDocument, dto: CreateBookingDto): Promise<void> {
    const requested = this.getNormalizedInterval(space, dto);
    const rentalUnit = dto.rentalUnit || space.rentalUnit || 'whole_room';
    const workstationQuantity = dto.workstationQuantity || 1;

    const sameDayBookings = await this.bookingModel.find({
      space: new mongoose.Types.ObjectId(dto.spaceId),
      date: new Date(dto.date),
      status: { $ne: 'cancelled' },
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

    if (rentalUnit === 'whole_room' || overlapping.some((booking) => booking.rentalUnit === 'whole_room')) {
      throw new BadRequestException('Lo spazio e gia prenotato in questa fascia oraria');
    }

    const usedWorkstations = overlapping.reduce((total, booking) => total + (booking.workstationQuantity || 1), 0);
    if (usedWorkstations + workstationQuantity > (space.workstationCount || 1)) {
      throw new BadRequestException('Postazioni non disponibili in questa fascia oraria');
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
      return space.dailyRate || 0;
    }

    const { start, end } = this.getNormalizedInterval(space, dto);
    const fraction = space.timeSlotMinutes || 60;
    const units = Math.ceil((end - start) / fraction);
    const quantity = (dto.rentalUnit || space.rentalUnit) === 'workstation' ? (dto.workstationQuantity || 1) : 1;
    return units * (space.hourlyRate || 0) * quantity;
  }

  private defaultOpeningHours() {
    return [
      { day: 0, isOpen: false, openTime: '09:00', closeTime: '18:00' },
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 6, isOpen: false, openTime: '09:00', closeTime: '18:00' },
    ];
  }

  async findAll(filterDto: FilterBookingsDto): Promise<BookingWithPayments[]> {
    const { spaceId, userId, date, status, start, end, search } = filterDto;

    const query: FilterQuery<Booking> = {};

    if (spaceId) query.space = new Types.ObjectId(spaceId);
    if (userId) query.user = new Types.ObjectId(userId);
    if (date) query.date = date;

    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = new Date(start);
      if (end) query.date.$lte = new Date(end);
    }

    if (status) query.status = status;

    const bookings = await this.bookingModel
      .find(query)
      .populate('user')
      .populate('space')
      .exec();

    const normalizedSearch = search?.trim().toLowerCase();
    const filteredBookings = normalizedSearch
      ? bookings.filter((booking: any) => {
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

    const bookingsWithPayments: BookingWithPayments[] = await Promise.all(
      filteredBookings.map(async (booking) => {
        const payments = await this.paymentModel.find({ bookingId: booking._id }).exec();
        return { booking, payments };
      }),
    );

    return bookingsWithPayments;
  }

  async findByUser(userId: string): Promise<Booking[]> {
    return this.bookingModel.find({ user: userId }).populate('space').exec();
  }

  async findBySpace(spaceId: string): Promise<Booking[]> {
    return this.bookingModel.find({ space: spaceId }).populate('user').exec();
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

  async remove(id: string): Promise<{ deleted: boolean }> {
    const result = await this.bookingModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Booking #${id} not found`);
    }
    return { deleted: true };
  }
}
