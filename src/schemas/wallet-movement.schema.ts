import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';
import { Booking } from './booking.schema';

@Schema({ timestamps: true })
export class WalletMovement extends Document {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  type: 'credit' | 'debit';

  @Prop({ required: true, enum: ['cancellation_refund', 'booking_payment', 'course_payment', 'signup_bonus', 'manual'] })
  reason: 'cancellation_refund' | 'booking_payment' | 'course_payment' | 'signup_bonus' | 'manual';

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, default: 'EUR' })
  currency: 'EUR';

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' })
  booking?: Booking;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'CourseBooking' })
  courseBooking?: mongoose.Types.ObjectId;

  @Prop()
  description?: string;
}

export type WalletMovementDocument = WalletMovement & Document;
export const WalletMovementSchema = SchemaFactory.createForClass(WalletMovement);
