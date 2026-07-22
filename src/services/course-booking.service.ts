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

type PopulatedCourseBooking = CourseBooking & {
  course?: {
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
  ) {}

  async create(dto: CreateCourseBookingDto, userId: string): Promise<CourseBooking> {
    const targetUserId = dto.userId || userId;
    const course = await this.courseModel.findById(dto.courseId).populate('booking').exec();
    if (!course) {
      throw new NotFoundException('Corso non trovato');
    }

    const spaceBooking = course.booking as unknown as { status?: string; space?: { toString(): string } | string } | undefined;
    if (spaceBooking?.status === 'cancelled') {
      throw new BadRequestException('Non puoi iscriverti a un corso collegato a una prenotazione annullata');
    }

    if (spaceBooking?.status === 'cancellation_requested') {
      throw new BadRequestException('Non puoi iscriverti mentre la prenotazione dello spazio e in richiesta di annullamento');
    }

    const existing = await this.courseBookingModel.findOne({
      course: new Types.ObjectId(dto.courseId),
      user: new Types.ObjectId(targetUserId),
      status: { $ne: 'cancelled' },
    }).exec();

    if (existing) {
      throw new BadRequestException('Utente gia iscritto al corso');
    }

    const bookedSeats = await this.courseBookingModel.countDocuments({
      course: new Types.ObjectId(dto.courseId),
      status: { $ne: 'cancelled' },
    }).exec();

    if (bookedSeats >= course.capacity) {
      throw new BadRequestException('Posti corso esauriti');
    }

    const user = await this.userModel.findById(targetUserId).exec();
    const monthlyPurchaseCount = await this.monthlyCoursePurchaseCount(targetUserId, course.date);
    const originalAmount = course.enrollmentType === 'free' ? 0 : course.price;
    const courseSpaceId = typeof spaceBooking?.space === 'string'
      ? spaceBooking.space
      : spaceBooking?.space?.toString();
    const discount = await this.discountCodeService.apply(dto.discountCode, 'course', originalAmount, courseSpaceId, course.date, {
      role: user?.role,
      createdAt: (user as unknown as { createdAt?: Date })?.createdAt,
      monthlyPurchaseCount,
    });
    const totalAmount = Math.max(originalAmount - discount.amount, 0);
    const walletBalance = totalAmount > 0 ? Math.max(await this.walletService.balance(targetUserId), 0) : 0;
    const walletAmount = Math.min(walletBalance, totalAmount);
    const externalAmount = Math.max(totalAmount - walletAmount, 0);

    const booking = new this.courseBookingModel({
      user: new Types.ObjectId(targetUserId),
      course: new Types.ObjectId(dto.courseId),
      status: course.enrollmentType === 'free' || externalAmount <= 0 ? 'confirmed' : 'pending',
      enrollmentType: course.enrollmentType,
      amount: externalAmount,
      totalAmount,
      walletAmount,
      externalAmount,
      originalAmount,
      discountAmount: discount.amount,
      discountCode: discount.code,
      paymentStatus: course.enrollmentType === 'free' ? 'FREE' : externalAmount <= 0 ? 'PAID' : 'PENDING',
    });
    const saved = await booking.save();
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
            user?: { name?: string; email?: string };
            space?: { name?: string };
          };
        };
      } | null;
    const subscriber = populated?.user;
    const manager = populated?.course?.booking?.user;
    const space = populated?.course?.booking?.space;
    await this.notificationsService.create({
      audience: 'admin',
      title: 'Nuova iscrizione corso',
      message: `${subscriber?.name || subscriber?.email || 'Cliente'} si e iscritto a "${course.title}" di ${manager?.name || manager?.email || 'Gestore'} in ${space?.name || 'uno spazio'} per il ${this.formatNotificationDate(course.date)}.`,
      type: 'course_booking_created',
      link: '/course-bookings',
    });
    return saved;
  }

  async findAll(filters: FilterCourseBookingDto & { managerId?: string }): Promise<CourseBooking[]> {
    const query: FilterQuery<CourseBooking> = {};
    if (filters.userId) query.user = new Types.ObjectId(filters.userId);
    if (filters.courseId) query.course = new Types.ObjectId(filters.courseId);
    if (filters.status) query.status = filters.status;
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

    await this.courseBookingModel.findByIdAndDelete(id).exec();
    return { deleted: true };
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
      status: { $ne: 'cancelled' },
    }).exec();
  }
}
