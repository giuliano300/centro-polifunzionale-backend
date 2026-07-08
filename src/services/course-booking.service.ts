import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CourseBooking } from 'src/schemas/course-booking.schema';
import { CreateCourseBookingDto } from 'src/dto/create-course-booking.dto';
import { FilterCourseBookingDto } from 'src/filters/filter-course-booking.dto';
import { Course, CourseDocument } from 'src/schemas/course.schema';

@Injectable()
export class CourseBookingsService {
  constructor(
    @InjectModel(CourseBooking.name) private courseBookingModel: Model<CourseBooking>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
  ) {}

  async create(dto: CreateCourseBookingDto, userId: string): Promise<CourseBooking> {
    const targetUserId = dto.userId || userId;
    const course = await this.courseModel.findById(dto.courseId).exec();
    if (!course) {
      throw new NotFoundException('Corso non trovato');
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

    const booking = new this.courseBookingModel({
      user: new Types.ObjectId(targetUserId),
      course: new Types.ObjectId(dto.courseId),
      status: course.enrollmentType === 'free' ? 'confirmed' : 'pending',
      enrollmentType: course.enrollmentType,
      amount: course.enrollmentType === 'free' ? 0 : course.price,
      paymentStatus: course.enrollmentType === 'free' ? 'FREE' : 'PENDING',
    });
    return booking.save();
  }

  async findAll(filters: FilterCourseBookingDto): Promise<CourseBooking[]> {
    const query: FilterQuery<CourseBooking> = {};
    if (filters.userId) query.user = new Types.ObjectId(filters.userId);
    if (filters.courseId) query.course = new Types.ObjectId(filters.courseId);
    if (filters.status) query.status = filters.status;
    return this.courseBookingModel.find(query).populate('user').populate({
      path: 'course',
      populate: {
        path: 'booking',
        populate: [
          { path: 'user' },
          { path: 'space' },
        ],
      },
    }).exec();
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    const deleted = await this.courseBookingModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Iscrizione corso non trovata');
    }

    return { deleted: true };
  }
}
