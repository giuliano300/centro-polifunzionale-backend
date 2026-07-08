import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
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

    const course = new this.courseModel({
      ...dto,
      price: dto.enrollmentType === 'free' ? 0 : dto.price,
      isPublished: dto.isPublished ?? true,
    });
    return course.save();
  }

  async findAll(): Promise<Course[]> {
    return this.courseModel.find().populate({
      path: 'booking',
      populate: [
        { path: 'user' },
        { path: 'space' },
      ],
    }).populate('participants');
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

  async update(id: string, dto: UpdateCourseDto): Promise<Course | null> {
    return this.courseModel.findByIdAndUpdate(id, dto, { new: true });
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
