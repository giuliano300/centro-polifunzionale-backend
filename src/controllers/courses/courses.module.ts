import { MongooseModule } from "@nestjs/mongoose";
import { Module } from '@nestjs/common';
import { CoursesController } from "./courses.controller";
import { CourseService } from "src/services/course.service";
import { Course, CourseSchema } from "src/schemas/course.schema";
import { Booking, BookingSchema } from "src/schemas/booking.schema";
import { Payment, PaymentSchema } from "src/schemas/payment.schema";
import { CourseBooking, CourseBookingSchema } from "src/schemas/course-booking.schema";


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: CourseBooking.name, schema: CourseBookingSchema },
    ])
  ],
  controllers: [CoursesController],
  providers: [CourseService],
})
export class CoursesModule {}
