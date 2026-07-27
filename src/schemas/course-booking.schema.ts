import { Prop, SchemaFactory,Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Document } from 'mongoose';
import { PaymentMethod, PAYMENT_METHOD_VALUES } from "src/payments/payment-method.enum";

@Schema({ timestamps: true })
export class CourseBooking extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  user: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true })
  course: string;

  @Prop({ default: 'pending' })
  status: 'pending' | 'confirmed' | 'cancelled';

  @Prop({ required: true, enum: ['paid', 'free'], default: 'free' })
  enrollmentType: 'paid' | 'free';

  @Prop({ default: 0, min: 0 })
  amount: number;

  @Prop({ default: 0, min: 0 })
  totalAmount: number;

  @Prop({ default: 0, min: 0 })
  walletAmount: number;

  @Prop({ default: 0, min: 0 })
  externalAmount: number;

  @Prop({ default: 0, min: 0 })
  originalAmount: number;

  @Prop({ default: 0, min: 0 })
  discountAmount: number;

  @Prop()
  discountCode?: string;

  @Prop({ enum: PAYMENT_METHOD_VALUES })
  paymentMethod?: PaymentMethod;

  @Prop({ required: true, enum: ['PENDING', 'PAID', 'FREE'], default: 'FREE' })
  paymentStatus: 'PENDING' | 'PAID' | 'FREE';
}
export const CourseBookingSchema = SchemaFactory.createForClass(CourseBooking);
