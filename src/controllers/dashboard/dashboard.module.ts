import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from 'src/services/dashboard.service';
import { Booking, BookingSchema } from 'src/schemas/booking.schema';
import { Course, CourseSchema } from 'src/schemas/course.schema';
import { CourseBooking, CourseBookingSchema } from 'src/schemas/course-booking.schema';
import { Payment, PaymentSchema } from 'src/schemas/payment.schema';
import { Space, SpaceSchema } from 'src/schemas/space.schema';
import { User, UserSchema } from 'src/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Space.name, schema: SpaceSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Course.name, schema: CourseSchema },
      { name: CourseBooking.name, schema: CourseBookingSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
