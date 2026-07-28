import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { mkdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { Course, CourseDocument } from "../schemas/course.schema";
import { CreateCourseDto } from "../dto/create-course.dto";
import { UpdateCourseDto } from "src/dto/update-course.dto";
import { Booking, BookingDocument } from "src/schemas/booking.schema";
import { Payment, PaymentDocument } from "src/schemas/payment.schema";
import { CourseBooking } from "src/schemas/course-booking.schema";
import { NotificationsService } from "./notifications.service";
import { COURSE_TAG_VALUES, CourseTag } from "src/courses/course-tag.enum";
import { CourseApprovalStatus } from "src/courses/course-approval-status.enum";
import { WalletService } from "./wallet.service";

type SearchableCourse = CourseDocument & {
  booking?: {
    name?: string;
    status?: 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled';
    user?: {
      _id?: string;
      name?: string;
      email?: string;
    };
    space?: {
      name?: string;
    };
  };
};

type ImageDimensions = {
  width: number;
  height: number;
};

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(CourseBooking.name) private courseBookingModel: Model<CourseBooking>,
    private notificationsService: NotificationsService,
    private walletService: WalletService,
  ) {}

  async create(dto: CreateCourseDto, managerId?: string): Promise<Course> {
    const normalized = await this.validateCourseRules(dto, undefined, managerId);
    const approvalStatus = managerId ? CourseApprovalStatus.Pending : (normalized.approvalStatus || CourseApprovalStatus.Approved);

    const course = new this.courseModel({
      ...normalized,
      price: normalized.enrollmentType === 'free' ? 0 : normalized.price,
      isPublished: managerId ? false : (normalized.isPublished ?? approvalStatus === CourseApprovalStatus.Approved),
      approvalStatus,
      approvedAt: approvalStatus === CourseApprovalStatus.Approved ? new Date() : undefined,
    });
    const saved = await course.save();
    const booking = await this.bookingModel.findById(saved.booking).populate('user').populate('space').exec();
    const manager = booking?.user as unknown as { name?: string; email?: string } | undefined;
    const space = booking?.space as unknown as { name?: string } | undefined;
    await this.notificationsService.create({
      audience: 'admin',
      title: 'Nuovo corso in approvazione',
      message: `${manager?.name || manager?.email || 'Gestore'} ha creato "${saved.title}" in ${space?.name || 'uno spazio'} per il ${this.formatNotificationDate(saved.date)}. Serve approvazione.`,
      type: 'course_created',
      link: this.monthLink('/courses', saved.date),
    });
    return saved;
  }

  async saveCourseImage(file: any, type: 'banner' | 'card' = 'banner'): Promise<{ imageUrl: string; width: number; height: number; size: number; mimeType: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('Carica un immagine valida');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato immagine non valido. Usa JPG, PNG o WEBP');
    }

    const maxSize = 8 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('Immagine troppo pesante. Dimensione massima 8 MB');
    }

    const dimensions = this.readImageDimensions(file.buffer, file.mimetype);
    const minWidth = type === 'card' ? 600 : 1200;
    const minHeight = 800;
    if (!dimensions || dimensions.width < minWidth || dimensions.height < minHeight) {
      throw new BadRequestException(`Immagine troppo piccola. Carica una foto almeno ${minWidth}x${minHeight} px`);
    }

    const uploadDir = join(process.cwd(), 'uploads', 'course-images');
    await mkdir(uploadDir, { recursive: true });

    const extension = this.imageExtension(file.mimetype, file.originalname);
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    await writeFile(join(uploadDir, filename), file.buffer);

    return {
      imageUrl: `/uploads/course-images/${filename}`,
      width: dimensions.width,
      height: dimensions.height,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  private async validateCourseRules(dto: CreateCourseDto, courseId?: string, managerId?: string): Promise<CreateCourseDto> {
    const booking = await this.bookingModel.findById(dto.booking).populate('space').exec();
    if (!booking) {
      throw new NotFoundException('Prenotazione spazio non trovata');
    }

    if (managerId && booking.user.toString() !== managerId) {
      throw new BadRequestException('Prenotazione non accessibile per questo gestore');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException('Non puoi gestire un corso per una prenotazione annullata');
    }

    if (booking.status === 'cancellation_requested') {
      throw new BadRequestException("Non puoi gestire un corso mentre la prenotazione è in richiesta d'annullamento");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Il corso può essere creato solo per prenotazioni di oggi o future');
    }

    const space = booking.space as unknown as { courseCreationAdvanceHours?: number };
    const advanceHours = Number(space?.courseCreationAdvanceHours ?? 2);
    const bookingStart = this.bookingStartDate(booking.date, booking.startTime);
    const creationDeadline = new Date(bookingStart.getTime() - (advanceHours * 60 * 60 * 1000));
    const now = new Date();

    if (now > creationDeadline) {
      throw new BadRequestException(`Il corso può essere creato solo fino a ${advanceHours} ore prima dell'inizio della prenotazione`);
    }

    const duplicateQuery: FilterQuery<Course> = { booking: new Types.ObjectId(dto.booking) };
    if (courseId) {
      duplicateQuery._id = { $ne: new Types.ObjectId(courseId) };
    }
    const duplicateCourse = await this.courseModel.findOne(duplicateQuery).exec();
    if (duplicateCourse) {
      throw new BadRequestException('Esiste gia un corso per questa prenotazione');
    }

    const paidPayment = await this.paymentModel.findOne({
      bookingId: dto.booking,
      status: 'PAID',
    }).exec();

    if (!paidPayment) {
      throw new BadRequestException('Per organizzare un corso lo spazio deve risultare pagato');
    }

    if (dto.enrollmentType === 'paid' && (!dto.price || dto.price <= 0)) {
      throw new BadRequestException('Un corso a pagamento deve avere un prezzo maggiore di zero');
    }

    return {
      ...dto,
      tags: this.normalizeTags(dto.tags),
      imageUrl: dto.imageUrl?.trim(),
      imageCrop: this.normalizeImageCrop(dto.imageCrop),
      bannerImageUrl: dto.bannerImageUrl?.trim(),
      bannerImageCrop: this.normalizeImageCrop(dto.bannerImageCrop),
      cardImageUrl: dto.cardImageUrl?.trim(),
      cardImageCrop: this.normalizeImageCrop(dto.cardImageCrop),
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
    };
  }

  async findAll(filters: { start?: string; end?: string; status?: string; search?: string; managerId?: string } = {}): Promise<Course[]> {
    const query: FilterQuery<Course> = {};
    if (filters.start || filters.end) {
      query.date = {};
      if (filters.start) query.date.$gte = new Date(filters.start);
      if (filters.end) query.date.$lte = new Date(filters.end);
    }
    if (filters.status === 'published') {
      query.isPublished = true;
      query.$or = [
        { approvalStatus: CourseApprovalStatus.Approved },
        { approvalStatus: { $exists: false } },
      ];
    }
    if (filters.status === 'closed') query.isPublished = false;
    if (filters.status === 'pending') query.approvalStatus = CourseApprovalStatus.Pending;
    if (filters.status === 'approved') query.approvalStatus = CourseApprovalStatus.Approved;
    if (filters.status === 'rejected') query.approvalStatus = CourseApprovalStatus.Rejected;

    let courses = await this.courseModel.find(query).sort({ createdAt: -1, _id: -1 }).populate({
      path: 'booking',
      populate: [
        { path: 'user' },
        { path: 'space' },
      ],
    }).populate('participants') as unknown as SearchableCourse[];

    if (filters.managerId) {
      courses = courses.filter((course) => {
        const booking = typeof course.booking === 'string' ? null : course.booking;
        const user = typeof booking?.user === 'string' ? booking.user : booking?.user?._id?.toString();
        return user === filters.managerId;
      });
    }

    courses = courses.filter((course) => {
      const booking = typeof course.booking === 'string' ? null : course.booking;
      return booking?.status !== 'cancelled' && booking?.status !== 'cancellation_requested';
    });

    const normalizedSearch = filters.search?.trim().toLowerCase();
    if (!normalizedSearch) {
      return courses as unknown as Course[];
    }

    return courses.filter((course) => {
      const text = [
        course.title,
        course.description,
        course.enrollmentType,
        course.booking?.name,
        course.booking?.user?.name,
        course.booking?.user?.email,
        course.booking?.space?.name,
      ].join(' ').toLowerCase();
      return text.includes(normalizedSearch);
    }) as unknown as Course[];
  }

  async findOne(id: string): Promise<Course | null> {
    return this.courseModel.findById(id).populate({
      path: 'booking',
      populate: [
        { path: 'user' },
        { path: 'space' },
      ],
    }).populate('participants');
  }

  async update(id: string, dto: UpdateCourseDto, managerId?: string): Promise<Course> {
    const current = await this.courseModel.findById(id).exec();
    if (!current) {
      throw new NotFoundException('Corso non trovato');
    }

    const merged = {
      title: dto.title ?? current.title,
      description: dto.description ?? current.description,
      date: dto.date ?? current.date,
      startTime: dto.startTime ?? current.startTime,
      endTime: dto.endTime ?? current.endTime,
      booking: dto.booking ?? current.booking.toString(),
      capacity: dto.capacity ?? current.capacity,
      enrollmentType: dto.enrollmentType ?? current.enrollmentType,
      price: dto.enrollmentType === 'free' ? 0 : (dto.price ?? current.price),
      isPublished: dto.isPublished ?? current.isPublished,
      approvalStatus: dto.approvalStatus ?? current.approvalStatus,
      tags: dto.tags ?? current.tags,
      imageUrl: dto.imageUrl ?? current.imageUrl,
      imageCrop: dto.imageCrop ?? current.imageCrop,
      bannerImageUrl: dto.bannerImageUrl ?? current.bannerImageUrl,
      bannerImageCrop: dto.bannerImageCrop ?? current.bannerImageCrop,
      cardImageUrl: dto.cardImageUrl ?? current.cardImageUrl,
      cardImageCrop: dto.cardImageCrop ?? current.cardImageCrop,
    } as CreateCourseDto;

    const normalized = await this.validateCourseRules(merged, id, managerId);

    const bookedSeats = await this.courseBookingModel.countDocuments({
      course: new Types.ObjectId(id),
      status: { $ne: 'cancelled' },
    }).exec();

    if (normalized.capacity < bookedSeats) {
      throw new BadRequestException('La capienza non può essere inferiore agli iscritti attuali');
    }

    const updateData: any = {
      ...normalized,
      approvalStatus: normalized.approvalStatus || CourseApprovalStatus.Pending,
    };

    if (managerId) {
      updateData.isPublished = false;
      updateData.approvalStatus = CourseApprovalStatus.Pending;
      updateData.approvedAt = undefined;
      updateData.approvedBy = undefined;
    } else if (normalized.isPublished) {
      updateData.approvalStatus = CourseApprovalStatus.Approved;
      updateData.approvedAt = new Date();
    }

    const updated = await this.courseModel.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).exec();
    if (!updated) {
      throw new NotFoundException('Corso non trovato');
    }

    await this.notifyCourseClients(
      updated,
      'Corso modificato',
      `Il corso "${updated.title}" del ${this.formatNotificationDate(updated.date)} e stato modificato. Controlla i dettagli aggiornati.`,
      'client_course_updated',
    );

    if (managerId) {
      const booking = await this.bookingModel.findById(updated.booking).populate('user').populate('space').exec();
      const manager = booking?.user as unknown as { name?: string; email?: string } | undefined;
      const space = booking?.space as unknown as { name?: string } | undefined;
      await this.notificationsService.create({
        audience: 'admin',
        title: 'Corso modificato',
        message: `${manager?.name || manager?.email || 'Gestore'} ha modificato "${updated.title}" in ${space?.name || 'uno spazio'} per il ${this.formatNotificationDate(updated.date)}. Serve nuova approvazione.`,
        type: 'course_updated',
        link: this.monthLink('/courses', updated.date),
      });
    }

    return updated;
  }

  async approve(id: string, adminId?: string): Promise<Course> {
    const course = await this.courseModel.findById(id).exec();
    if (!course) {
      throw new NotFoundException('Corso non trovato');
    }

    const updated = await this.courseModel.findByIdAndUpdate(
      id,
      {
        isPublished: true,
        approvalStatus: CourseApprovalStatus.Approved,
        approvedAt: new Date(),
        approvedBy: adminId ? new Types.ObjectId(adminId) : undefined,
      },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      throw new NotFoundException('Corso non trovato');
    }

    await this.notifyCourseManager(updated, 'Corso approvato', 'e stato approvato', 'course_approved');

    return updated;
  }

  async close(id: string): Promise<Course> {
    const updated = await this.courseModel.findByIdAndUpdate(
      id,
      {
        isPublished: false,
        approvalStatus: CourseApprovalStatus.Approved,
      },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      throw new NotFoundException('Corso non trovato');
    }

    await this.notifyCourseManager(updated, 'Corso chiuso', "è stato chiuso dall'amministrazione", 'course_closed');
    await this.refundCourseBookingsToWallet(
      updated,
      'Rimborso automatico per chiusura corso',
    );
    await this.notifyCourseClients(
      updated,
      'Corso chiuso',
      `Il corso "${updated.title}" del ${this.formatNotificationDate(updated.date)} è stato chiuso. L'eventuale importo pagato è stato accreditato nel wallet.`,
      'client_course_closed',
    );
    return updated;
  }

  async reject(id: string): Promise<Course> {
    const updated = await this.courseModel.findByIdAndUpdate(
      id,
      {
        isPublished: false,
        approvalStatus: CourseApprovalStatus.Rejected,
        approvedAt: undefined,
        approvedBy: undefined,
      },
      { new: true, runValidators: true },
    ).exec();

    if (!updated) {
      throw new NotFoundException('Corso non trovato');
    }

    await this.notifyCourseManager(updated, 'Corso disapprovato', "non è stato approvato dall'amministrazione", 'course_rejected');
    await this.notifyCourseClients(
      updated,
      'Corso non approvato',
      `Il corso "${updated.title}" del ${this.formatNotificationDate(updated.date)} non è più disponibile.`,
      'client_course_rejected',
    );
    return updated;
  }

  async remove(id: string, managerId?: string): Promise<{ deleted: boolean }> {
    const course = await this.courseModel.findById(id).exec();
    if (!course) {
      throw new NotFoundException('Corso non trovato');
    }

    if (managerId) {
      await this.validateCourseRules({
        title: course.title,
        description: course.description,
        date: course.date,
        startTime: course.startTime,
        endTime: course.endTime,
        booking: course.booking.toString(),
        capacity: course.capacity,
        enrollmentType: course.enrollmentType,
        price: course.price,
        isPublished: course.isPublished,
        tags: course.tags,
        imageUrl: course.imageUrl,
        imageCrop: course.imageCrop,
        bannerImageUrl: course.bannerImageUrl,
        bannerImageCrop: course.bannerImageCrop,
        cardImageUrl: course.cardImageUrl,
        cardImageCrop: course.cardImageCrop,
      }, id, managerId);
    }

    await this.notifyCourseClients(
      course,
      'Corso annullato',
      `Il corso "${course.title}" del ${this.formatNotificationDate(course.date)} è stato annullato.`,
      'client_course_cancelled',
    );
    await this.courseModel.findByIdAndDelete(id).exec();
    await this.courseBookingModel.deleteMany({ course: id });
    return { deleted: true };
  }

  private formatNotificationDate(value: string | Date): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  private async notifyCourseManager(course: CourseDocument, title: string, actionText: string, type: string): Promise<void> {
    const booking = await this.bookingModel.findById(course.booking).populate('user').populate('space').exec();
    const populatedManager = booking?.user as unknown as { _id?: Types.ObjectId | string; toString?: () => string } | undefined;
    const managerId = populatedManager?._id?.toString?.() || populatedManager?.toString?.();
    const space = booking?.space as unknown as { name?: string } | undefined;
    if (!managerId) {
      return;
    }

    await this.notificationsService.create({
      audience: 'gestore',
      userId: managerId,
      title,
      message: `Il corso "${course.title}" in ${space?.name || 'uno spazio'} del ${this.formatNotificationDate(course.date)} ${actionText}.`,
      type,
      link: `/courses?courseId=${(course as any)._id}`,
    });
  }

  private async notifyCourseClients(course: CourseDocument, title: string, message: string, type: string): Promise<void> {
    const courseId = (course as unknown as { _id: Types.ObjectId })._id;
    const bookings = await this.courseBookingModel.find({
      course: courseId,
      status: { $ne: 'cancelled' },
    }).select('user').exec();
    const userIds = [...new Set(bookings.map((booking) => booking.user?.toString()).filter(Boolean))];

    await Promise.all(userIds.map((userId) => this.notificationsService.create({
      audience: 'cliente',
      userId,
      title,
      message,
      type,
      link: '/my-courses',
    })));
  }

  private async refundCourseBookingsToWallet(course: CourseDocument, description: string): Promise<void> {
    const courseId = (course as unknown as { _id: Types.ObjectId })._id;
    const bookings = await this.courseBookingModel.find({
      course: courseId,
      status: { $ne: 'cancelled' },
    }).exec();

    await Promise.all(bookings.map(async (booking) => {
      const amount = booking.paymentStatus === 'PAID'
        ? Number(booking.totalAmount || booking.walletAmount + booking.externalAmount || booking.amount || 0)
        : 0;
      if (amount > 0) {
        await this.walletService.creditCourseRefund(
          booking.user.toString(),
          (booking as unknown as { _id: Types.ObjectId })._id.toString(),
          amount,
          `${description}: ${course.title}`,
        );
      }
      booking.status = 'cancelled';
      await booking.save();
    }));

    await this.courseModel.findByIdAndUpdate(courseId, { $set: { participants: [] } }).exec();
  }

  private bookingStartDate(dateValue: string | Date, startTime: string): Date {
    const date = new Date(dateValue);
    const [hours, minutes] = startTime.split(':').map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }

  private normalizeTags(tags?: string[]): CourseTag[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    const allowedTags = new Set<string>(COURSE_TAG_VALUES);
    return [...new Set(
      tags
        .map((tag) => String(tag || '').trim().toLowerCase())
        .filter((tag) => allowedTags.has(tag))
        .slice(0, 20),
    )] as CourseTag[];
  }

  private normalizeImageCrop(crop?: { x?: number; y?: number; scale?: number }): { x: number; y: number; scale: number } {
    return {
      x: Math.max(-50, Math.min(50, Number(crop?.x || 0))),
      y: Math.max(-50, Math.min(50, Number(crop?.y || 0))),
      scale: Math.max(1, Math.min(2.5, Number(crop?.scale || 1))),
    };
  }

  private imageExtension(mimeType: string, originalName?: string): string {
    const extensionByMime: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };

    return extensionByMime[mimeType] || extname(originalName || '') || '.jpg';
  }

  private monthLink(basePath: string, value: string | Date): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return basePath;
    }

    return `${basePath}?month=${date.getMonth() + 1}&year=${date.getFullYear()}`;
  }

  private readImageDimensions(buffer: Buffer, mimeType: string): ImageDimensions | null {
    if (mimeType === 'image/png' && buffer.length >= 24) {
      return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
      };
    }

    if (mimeType === 'image/jpeg') {
      return this.readJpegDimensions(buffer);
    }

    if (mimeType === 'image/webp') {
      return this.readWebpDimensions(buffer);
    }

    return null;
  }

  private readJpegDimensions(buffer: Buffer): ImageDimensions | null {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        return null;
      }

      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      const isSofMarker = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSofMarker) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }

      offset += 2 + length;
    }

    return null;
  }

  private readWebpDimensions(buffer: Buffer): ImageDimensions | null {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
      return null;
    }

    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }

    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }

    if (chunk === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }

    return null;
  }
}
