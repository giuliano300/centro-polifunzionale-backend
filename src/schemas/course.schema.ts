import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Booking } from './booking.schema';

// course.schema.ts
@Schema()
export class Course {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true })
  booking: Booking;

  @Prop({ required: true, min: 1 })
  capacity: number;

  @Prop({ required: true, enum: ['paid', 'free'], default: 'free' })
  enrollmentType: 'paid' | 'free';

  @Prop({ default: 0, min: 0 })
  price: number;

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({ default: [], type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] })
  participants: mongoose.Types.ObjectId[];
}


export type CourseDocument = Course & Document;

export const CourseSchema = SchemaFactory.createForClass(Course);
