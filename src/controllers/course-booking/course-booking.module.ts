import { MongooseModule } from "@nestjs/mongoose";
import { Module } from '@nestjs/common';
import { CourseBookingsController } from "./course-booking.controller";
import { CourseBookingsService } from "src/services/course-booking.service";
import { CourseBooking, CourseBookingSchema } from "src/schemas/course-booking.schema";
import { Course, CourseSchema } from "src/schemas/course.schema";
import { NotificationsModule } from "../notifications/notifications.module";


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseBooking.name, schema: CourseBookingSchema },
      { name: Course.name, schema: CourseSchema }
    ]),
    NotificationsModule
  ],
  controllers: [CourseBookingsController],
  providers: [CourseBookingsService],
})
export class CourseBookingModule {}
