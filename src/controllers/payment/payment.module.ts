import { MongooseModule } from "@nestjs/mongoose";
import { Module } from '@nestjs/common';
import { PaymentController } from "./payment.controller";
import { PaymentService } from "../../services/payment.service";
import { Payment, PaymentSchema } from "../../schemas/payment.schema";
import { Booking, BookingSchema } from "../../schemas/booking.schema";


@Module({
  imports: [MongooseModule.forFeature([
    { name: Payment.name, schema: PaymentSchema },
    { name: Booking.name, schema: BookingSchema },
  ])],
  controllers: [PaymentController],
  providers: [PaymentService],
})
export class PaymentModule {}
