import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CourseBooking } from 'src/schemas/course-booking.schema';
import { CreateCourseBookingDto } from 'src/dto/create-course-booking.dto';
import { FilterCourseBookingDto } from 'src/filters/filter-course-booking.dto';
import { Course, CourseDocument } from 'src/schemas/course.schema';
import { User, UserDocument } from 'src/schemas/user.schema';
import { NotificationsService } from './notifications.service';
import { WalletService } from './wallet.service';
import { DiscountCodeService } from './discount-code.service';
import { DEFAULT_PAYMENT_METHODS, PaymentMethod } from 'src/payments/payment-method.enum';
import { SystemSettingsService } from './system-settings.service';

type PopulatedCourseBooking = CourseBooking & {
  course?: {
    date?: Date | string;
    booking?: {
      status?: 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled';
      user?: { _id?: string } | string;
    };
  };
};

@Injectable()
export class CourseBookingsService {
  constructor(
    @InjectModel(CourseBooking.name) private courseBookingModel: Model<CourseBooking>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private notificationsService: NotificationsService,
    private walletService: WalletService,
    private discountCodeService: DiscountCodeService,
    private systemSettingsService: SystemSettingsService,
  ) {}

  async create(dto: CreateCourseBookingDto, userId: string, idempotencyKey?: string): Promise<CourseBooking> {
    const targetUserId = dto.userId || userId;
    await this.expirePendingCourseBookings();
    const normalizedKey = idempotencyKey?.trim().slice(0, 200);
    if (normalizedKey) {
      const replay = await this.courseBookingModel.findOne({ user: new Types.ObjectId(targetUserId), idempotencyKey: normalizedKey }).exec();
      if (replay) return replay;
    }
    const course = await this.courseModel.findById(dto.courseId)
      .populate({ path: 'booking', populate: { path: 'space' } })
      .exec();
    if (!course) {
      throw new NotFoundException('Corso non trovato');
    }

    const spaceBooking = course.booking as unknown as {
      status?: string;
      space?: { _id?: string; paymentMethods?: PaymentMethod[]; toString(): string } | string;
    } | undefined;
    if (spaceBooking?.status === 'cancelled') {
      throw new BadRequestException('Non puoi iscriverti a un corso collegato a una prenotazione annullata');
    }

    if (spaceBooking?.status === 'cancellation_requested') {
      throw new BadRequestException("Non puoi iscriverti mentre la prenotazione dello spazio è in richiesta d'annullamento");
    }

    const existing = await this.courseBookingModel.findOne({
      course: new Types.ObjectId(dto.courseId),
      user: new Types.ObjectId(targetUserId),
      $or: [
        { status: 'confirmed' },
        { status: 'pending', holdExpiresAt: { $gt: new Date() } },
      ],
    }).exec();

    if (existing) return existing;

    const bookedSeats = await this.courseBookingModel.countDocuments({
      course: new Types.ObjectId(dto.courseId),
      $or: [
        { status: 'confirmed' },
        { status: 'pending', holdExpiresAt: { $gt: new Date() } },
      ],
    }).exec();

    if (bookedSeats >= course.capacity) {
      throw new BadRequestException('Posti corso esauriti');
    }

    const user = await this.userModel.findById(targetUserId).exec();
    const monthlyPurchaseCount = await this.monthlyCoursePurchaseCount(targetUserId, course.date);
    const originalAmount = course.enrollmentType === 'free' ? 0 : course.price;
    const courseSpaceId = typeof spaceBooking?.space === 'string'
      ? spaceBooking.space
      : spaceBooking?.space?._id?.toString() || spaceBooking?.space?.toString();
    const discount = await this.discountCodeService.apply(dto.discountCode, 'course', originalAmount, courseSpaceId, course.date, {
      role: user?.role,
      createdAt: (user as unknown as { createdAt?: Date })?.createdAt,
      monthlyPurchaseCount,
    });
    const totalAmount = Math.max(originalAmount - discount.amount, 0);
    const walletBalance = totalAmount > 0 ? Math.max(await this.walletService.balance(targetUserId), 0) : 0;
    const walletAmount = Math.min(walletBalance, totalAmount);
    const externalAmount = Math.max(totalAmount - walletAmount, 0);
    const isManualEnrollment = !!dto.userId && dto.userId !== userId;
    const paymentMethod = externalAmount > 0 ? dto.paymentMethod || (isManualEnrollment ? PaymentMethod.Cash : undefined) : undefined;
    if (externalAmount > 0 && !paymentMethod) {
      throw new BadRequestException('Seleziona un metodo di pagamento');
    }
    if (paymentMethod) {
      this.assertCoursePaymentMethodAllowed(spaceBooking?.space, paymentMethod);
    }
    const isExternalPaymentRegistered = paymentMethod === PaymentMethod.Cash;
    const isConfirmed = course.enrollmentType === 'free' || externalAmount <= 0 || isExternalPaymentRegistered;
    const holdMinutes = await this.systemSettingsService.bookingHoldMinutes();

    const booking = new this.courseBookingModel({
      user: new Types.ObjectId(targetUserId),
      course: new Types.ObjectId(dto.courseId),
      status: isConfirmed ? 'confirmed' : 'pending',
      holdExpiresAt: isConfirmed ? undefined : new Date(Date.now() + holdMinutes * 60_000),
      idempotencyKey: normalizedKey,
      enrollmentType: course.enrollmentType,
      amount: externalAmount,
      totalAmount,
      walletAmount,
      externalAmount,
      originalAmount,
      discountAmount: discount.amount,
      discountCode: discount.code,
      paymentMethod,
      paymentStatus: course.enrollmentType === 'free' ? 'FREE' : externalAmount <= 0 || isExternalPaymentRegistered ? 'PAID' : 'PENDING',
    });
    const saved = await booking.save();
    if (saved.status === 'confirmed') {
      await this.courseModel.findByIdAndUpdate(dto.courseId, {
        $addToSet: { participants: new Types.ObjectId(targetUserId) },
      }).exec();
    }
    await this.discountCodeService.markUsed(discount.code);
    if (walletAmount > 0) {
      await this.walletService.debitCoursePayment(
        targetUserId,
        (saved as unknown as { _id: Types.ObjectId })._id.toString(),
        walletAmount,
        `Utilizzo wallet per iscrizione al corso ${course.title}`,
      );
    }
    const populated = await this.courseBookingModel.findById((saved as unknown as { _id: Types.ObjectId })._id)
      .populate('user')
      .populate({
        path: 'course',
        populate: {
          path: 'booking',
          populate: [
            { path: 'user' },
            { path: 'space' },
          ],
        },
      })
      .exec() as unknown as {
        user?: { name?: string; email?: string };
        course?: {
          booking?: {
            user?: { _id?: string; name?: string; email?: string };
            space?: { name?: string };
          };
        };
      } | null;
    const subscriber = populated?.user;
    const manager = populated?.course?.booking?.user;
    const space = populated?.course?.booking?.space;
    const courseId = (course as unknown as { _id: Types.ObjectId })._id.toString();
    const courseDateLabel = this.formatNotificationDate(course.date);
    await this.notificationsService.create({
      audience: 'cliente',
      userId: targetUserId,
      title: saved.paymentStatus === 'PENDING' ? 'Pagamento corso da completare' : 'Iscrizione corso confermata',
      message: saved.paymentStatus === 'PENDING'
        ? `La tua iscrizione a "${course.title}" per il ${courseDateLabel} è stata registrata. Completa il pagamento per confermare il posto.`
        : `La tua iscrizione a "${course.title}" per il ${courseDateLabel} è confermata.`,
      type: 'client_course_booking_created',
      link: `/my-courses`,
    });
    await this.notificationsService.create({
      audience: 'admin',
      title: 'Nuova iscrizione corso',
      message: `${subscriber?.name || subscriber?.email || 'Cliente'} si è iscritto a "${course.title}" di ${manager?.name || manager?.email || 'Gestore'} in ${space?.name || 'uno spazio'} per il ${courseDateLabel}.`,
      type: 'course_booking_created',
      link: `/course-bookings?courseId=${courseId}`,
    });
    const managerId = manager?._id?.toString();
    if (managerId) {
      await this.notificationsService.create({
        audience: 'gestore',
        userId: managerId,
        title: 'Nuova iscrizione corso',
        message: `${subscriber?.name || subscriber?.email || 'Cliente'} si è iscritto a "${course.title}" in ${space?.name || 'uno spazio'} per il ${courseDateLabel}.`,
        type: 'course_booking_created',
        link: `/courses?courseId=${courseId}`,
      });
    }
    return saved;
  }

  async findAll(filters: FilterCourseBookingDto & { managerId?: string }): Promise<CourseBooking[]> {
    await this.expirePendingCourseBookings();
    const query: FilterQuery<CourseBooking> = {};
    if (filters.userId) query.user = new Types.ObjectId(filters.userId);
    if (filters.courseId) query.course = new Types.ObjectId(filters.courseId);
    if (filters.status) query.status = filters.status;
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    let courseBookings = await this.courseBookingModel.find(query).sort({ createdAt: -1, _id: -1 }).populate('user').populate({
      path: 'course',
      populate: {
        path: 'booking',
        populate: [
          { path: 'user' },
          { path: 'space' },
        ],
      },
    }).exec() as unknown as PopulatedCourseBooking[];

    if (filters.managerId) {
      courseBookings = courseBookings.filter((item) => {
        const course = item.course || null;
        const user = typeof course?.booking?.user === 'string'
          ? course.booking.user
          : course?.booking?.user?._id?.toString();
        return user === filters.managerId;
      });
    }

    courseBookings = courseBookings.filter((item) => {
      const course = item.course || null;
      const status = typeof course?.booking === 'string' ? null : course?.booking?.status;
      return status !== 'cancelled' && status !== 'cancellation_requested';
    });

    if (filters.start || filters.end) {
      const start = filters.start ? new Date(filters.start).getTime() : null;
      const end = filters.end ? new Date(filters.end).getTime() : null;
      courseBookings = courseBookings.filter((item) => {
        const course = item.course || null;
        const courseDate = course?.date ? new Date(course.date).getTime() : null;
        if (!courseDate) {
          return false;
        }
        if (start !== null && courseDate < start) {
          return false;
        }
        if (end !== null && courseDate >= end) {
          return false;
        }
        return true;
      });
    }

    return courseBookings as unknown as CourseBooking[];
  }

  async remove(id: string, allowedUserId?: string): Promise<{ deleted: boolean }> {
    const courseBooking = await this.courseBookingModel.findById(id).exec();
    if (!courseBooking) {
      throw new NotFoundException('Iscrizione corso non trovata');
    }

    if (allowedUserId && courseBooking.user.toString() !== allowedUserId) {
      throw new ForbiddenException('Iscrizione corso non accessibile');
    }

    await this.courseModel.findByIdAndUpdate(courseBooking.course, {
      $pull: { participants: new Types.ObjectId(courseBooking.user.toString()) },
    }).exec();
    await this.courseBookingModel.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  async updatePaymentMethod(id: string, paymentMethod: PaymentMethod, allowedUserId?: string): Promise<CourseBooking> {
    const courseBooking = await this.courseBookingModel.findById(id).populate({
      path: 'course',
      populate: {
        path: 'booking',
        populate: { path: 'space' },
      },
    }).exec() as unknown as (CourseBooking & {
      course?: {
        booking?: {
          space?: { paymentMethods?: PaymentMethod[] } | string;
        };
      };
    }) | null;
    if (!courseBooking) {
      throw new NotFoundException('Iscrizione corso non trovata');
    }

    if (allowedUserId && courseBooking.user.toString() !== allowedUserId) {
      throw new ForbiddenException('Iscrizione corso non accessibile');
    }

    const externalAmount = Number(courseBooking.externalAmount || courseBooking.amount || 0);
    if (externalAmount <= 0) {
      throw new BadRequestException('Questa iscrizione non ha un pagamento esterno da modificare');
    }

    if (courseBooking.paymentStatus !== 'PENDING') {
      throw new BadRequestException('Il metodo di pagamento può essere modificato solo sui pagamenti da completare');
    }
    if (courseBooking.status === 'expired' || (courseBooking.holdExpiresAt && courseBooking.holdExpiresAt <= new Date())) {
      throw new BadRequestException('Il tempo di priorità per il posto è scaduto');
    }

    const populatedCourse = courseBooking.course as unknown as { booking?: { space?: { paymentMethods?: PaymentMethod[] } | string } };
    const space = populatedCourse?.booking?.space;
    this.assertCoursePaymentMethodAllowed(space, paymentMethod);
    courseBooking.paymentMethod = paymentMethod;
    if (paymentMethod === PaymentMethod.Cash) {
      courseBooking.status = 'confirmed';
      courseBooking.paymentStatus = 'PAID';
      courseBooking.holdExpiresAt = undefined;
      await this.courseModel.findByIdAndUpdate(courseBooking.course, {
        $addToSet: { participants: new Types.ObjectId(courseBooking.user.toString()) },
      }).exec();
    }
    const saved = await courseBooking.save();
    if (paymentMethod === PaymentMethod.Cash) {
      const course = saved.course as unknown as { title?: string; date?: Date | string };
      await this.notificationsService.create({
        audience: 'cliente',
        userId: saved.user.toString(),
        title: 'Pagamento corso confermato',
        message: `Il pagamento in contanti per "${course?.title || 'il corso'}" è stato registrato. Il posto è confermato.`,
        type: 'client_course_payment_confirmed',
        link: '/my-courses',
      });
    }
    return saved;
  }

  private formatNotificationDate(value: string | Date): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  private async monthlyCoursePurchaseCount(userId: string, date: string | Date): Promise<number> {
    const target = new Date(date);
    const start = new Date(target.getFullYear(), target.getMonth(), 1);
    const end = new Date(target.getFullYear(), target.getMonth() + 1, 1);
    return this.courseBookingModel.countDocuments({
      user: new Types.ObjectId(userId),
      createdAt: { $gte: start, $lt: end },
      $or: [
        { status: 'confirmed' },
        { status: 'pending', holdExpiresAt: { $gt: new Date() } },
      ],
    }).exec();
  }

  private async expirePendingCourseBookings(): Promise<void> {
    const expired = await this.courseBookingModel.find({ status: 'pending', holdExpiresAt: { $lte: new Date() } }).exec();
    for (const booking of expired) {
      const bookingId = (booking._id as Types.ObjectId).toString();
      const updated = await this.courseBookingModel.findOneAndUpdate(
        { _id: booking._id, status: 'pending' },
        { $set: { status: 'expired' } },
        { new: true },
      ).exec();
      if (!updated) continue;
      if ((booking.walletAmount || 0) > 0) {
        await this.walletService.releaseCourseHold(booking.user.toString(), bookingId, booking.walletAmount);
      }
      await this.discountCodeService.releaseUsed(booking.discountCode);
    }
  }

  private assertCoursePaymentMethodAllowed(space: unknown, method: PaymentMethod): void {
    const normalizedSpace = typeof space === 'string' ? null : space as { paymentMethods?: PaymentMethod[] } | null;
    const paymentMethods = normalizedSpace?.paymentMethods?.length ? normalizedSpace.paymentMethods : DEFAULT_PAYMENT_METHODS;
    if (!paymentMethods.includes(method)) {
      throw new BadRequestException('Metodo di pagamento non disponibile per questo spazio');
    }
  }
}
