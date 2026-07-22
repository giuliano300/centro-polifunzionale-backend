import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { Course, CourseDocument } from "../schemas/course.schema";
import { CreateCourseDto } from "../dto/create-course.dto";
import { UpdateCourseDto } from "src/dto/update-course.dto";
import { Booking, BookingDocument } from "src/schemas/booking.schema";
import { Payment, PaymentDocument } from "src/schemas/payment.schema";
import { CourseBooking } from "src/schemas/course-booking.schema";
import { NotificationsService } from "./notifications.service";

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

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(CourseBooking.name) private courseBookingModel: Model<CourseBooking>,
    private notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateCourseDto, managerId?: string): Promise<Course> {
    const normalized = await this.validateCourseRules(dto, undefined, managerId);

    const course = new this.courseModel({
      ...normalized,
      price: normalized.enrollmentType === 'free' ? 0 : normalized.price,
      isPublished: normalized.isPublished ?? true,
    });
    const saved = await course.save();
    const booking = await this.bookingModel.findById(saved.booking).populate('user').populate('space').exec();
    const manager = booking?.user as unknown as { name?: string; email?: string } | undefined;
    const space = booking?.space as unknown as { name?: string } | undefined;
    await this.notificationsService.create({
      audience: 'admin',
      title: 'Nuovo corso creato',
      message: `${manager?.name || manager?.email || 'Gestore'} ha creato "${saved.title}" in ${space?.name || 'uno spazio'} per il ${this.formatNotificationDate(saved.date)}.`,
      type: 'course_created',
      link: '/courses',
    });
    return saved;
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
      throw new BadRequestException('Non puoi gestire un corso mentre la prenotazione e in richiesta di annullamento');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Il corso puo essere creato solo per prenotazioni di oggi o future');
    }

    const space = booking.space as unknown as { courseCreationAdvanceHours?: number };
    const advanceHours = Number(space?.courseCreationAdvanceHours ?? 2);
    const bookingStart = this.bookingStartDate(booking.date, booking.startTime);
    const creationDeadline = new Date(bookingStart.getTime() - (advanceHours * 60 * 60 * 1000));
    const now = new Date();

    if (now > creationDeadline) {
      throw new BadRequestException(`Il corso puo essere creato solo fino a ${advanceHours} ore prima dell inizio della prenotazione`);
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
    if (filters.status === 'published') query.isPublished = true;
    if (filters.status === 'closed') query.isPublished = false;

    let courses = await this.courseModel.find(query).sort({ _id: -1 }).populate({
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
    } as CreateCourseDto;

    const normalized = await this.validateCourseRules(merged, id, managerId);

    const bookedSeats = await this.courseBookingModel.countDocuments({
      course: new Types.ObjectId(id),
      status: { $ne: 'cancelled' },
    }).exec();

    if (normalized.capacity < bookedSeats) {
      throw new BadRequestException('La capienza non puo essere inferiore agli iscritti attuali');
    }

    const updated = await this.courseModel.findByIdAndUpdate(id, normalized, { new: true, runValidators: true }).exec();
    if (!updated) {
      throw new NotFoundException('Corso non trovato');
    }

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
      }, id, managerId);
    }

    await this.courseModel.findByIdAndDelete(id).exec();
    await this.courseBookingModel.deleteMany({ course: id });
    return { deleted: true };
  }

  private formatNotificationDate(value: string | Date): string {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
  }

  private bookingStartDate(dateValue: string | Date, startTime: string): Date {
    const date = new Date(dateValue);
    const [hours, minutes] = startTime.split(':').map(Number);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date;
  }
}
