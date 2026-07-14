import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { Course, CourseDocument } from "../schemas/course.schema";
import { CreateCourseDto } from "../dto/create-course.dto";
import { UpdateCourseDto } from "src/dto/update-course.dto";
import { Booking, BookingDocument } from "src/schemas/booking.schema";
import { Payment, PaymentDocument } from "src/schemas/payment.schema";
import { CourseBooking } from "src/schemas/course-booking.schema";

@Injectable()
export class CourseService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(CourseBooking.name) private courseBookingModel: Model<CourseBooking>,
  ) {}

  async create(dto: CreateCourseDto): Promise<Course> {
    await this.validateCourseRules(dto);

    const course = new this.courseModel({
      ...dto,
      price: dto.enrollmentType === 'free' ? 0 : dto.price,
      isPublished: dto.isPublished ?? true,
    });
    return course.save();
  }

  private async validateCourseRules(dto: CreateCourseDto, courseId?: string): Promise<void> {
    const booking = await this.bookingModel.findById(dto.booking).exec();
    if (!booking) {
      throw new NotFoundException('Prenotazione spazio non trovata');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bookingDate = new Date(booking.date);
    bookingDate.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Il corso puo essere creato solo per prenotazioni di oggi o future');
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
  }

  async findAll(filters: { start?: string; end?: string; status?: string; search?: string } = {}): Promise<Course[]> {
    const query: FilterQuery<Course> = {};
    if (filters.start || filters.end) {
      query.date = {};
      if (filters.start) query.date.$gte = new Date(filters.start);
      if (filters.end) query.date.$lte = new Date(filters.end);
    }
    if (filters.status === 'published') query.isPublished = true;
    if (filters.status === 'closed') query.isPublished = false;

    const courses = await this.courseModel.find(query).populate({
      path: 'booking',
      populate: [
        { path: 'user' },
        { path: 'space' },
      ],
    }).populate('participants');

    const normalizedSearch = filters.search?.trim().toLowerCase();
    if (!normalizedSearch) {
      return courses;
    }

    return courses.filter((course: any) => {
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
    });
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

  async update(id: string, dto: UpdateCourseDto): Promise<Course> {
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

    await this.validateCourseRules(merged, id);

    const bookedSeats = await this.courseBookingModel.countDocuments({
      course: new Types.ObjectId(id),
      status: { $ne: 'cancelled' },
    }).exec();

    if (merged.capacity < bookedSeats) {
      throw new BadRequestException('La capienza non puo essere inferiore agli iscritti attuali');
    }

    const updated = await this.courseModel.findByIdAndUpdate(id, merged, { new: true, runValidators: true }).exec();
    if (!updated) {
      throw new NotFoundException('Corso non trovato');
    }

    return updated;
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const deletedCourse = await this.courseModel.findByIdAndDelete(id);
    if (!deletedCourse) {
      throw new NotFoundException('Corso non trovato');
    }

    await this.courseBookingModel.deleteMany({ course: id });
    return { deleted: true };
  }
}
