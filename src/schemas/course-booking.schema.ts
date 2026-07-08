import { Prop, SchemaFactory,Schema } from "@nestjs/mongoose";
import mongoose from "mongoose";
import { Document } from 'mongoose';

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

  @Prop({ required: true, enum: ['PENDING', 'PAID', 'FREE'], default: 'FREE' })
  paymentStatus: 'PENDING' | 'PAID' | 'FREE';
}
export const CourseBookingSchema = SchemaFactory.createForClass(CourseBooking);
