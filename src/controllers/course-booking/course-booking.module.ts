import { MongooseModule } from "@nestjs/mongoose";
import { Module } from '@nestjs/common';
import { CourseBookingsController } from "./course-booking.controller";
import { CourseBookingsService } from "src/services/course-booking.service";
import { CourseBooking, CourseBookingSchema } from "src/schemas/course-booking.schema";
import { Course, CourseSchema } from "src/schemas/course.schema";
import { User, UserSchema } from "src/schemas/user.schema";
import { NotificationsModule } from "../notifications/notifications.module";
import { WalletModule } from "../wallet/wallet.module";
import { DiscountCodesModule } from "../discount-codes/discount-codes.module";
import { SystemSettingsModule } from "../system-settings/system-settings.module";


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseBooking.name, schema: CourseBookingSchema },
      { name: Course.name, schema: CourseSchema },
      { name: User.name, schema: UserSchema }
    ]),
    NotificationsModule,
    WalletModule,
    DiscountCodesModule,
    SystemSettingsModule
  ],
  controllers: [CourseBookingsController],
  providers: [CourseBookingsService],
})
export class CourseBookingModule {}
