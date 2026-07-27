import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { Booking } from './booking.schema';
import { COURSE_TAG_VALUES, CourseTag } from 'src/courses/course-tag.enum';
import { COURSE_APPROVAL_STATUS_VALUES, CourseApprovalStatus } from 'src/courses/course-approval-status.enum';

// course.schema.ts
@Schema()
export class Course {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: [String], enum: COURSE_TAG_VALUES, default: [] })
  tags: CourseTag[];

  @Prop()
  imageUrl?: string;

  @Prop({ type: { x: Number, y: Number, scale: Number }, default: { x: 0, y: 0, scale: 1 } })
  imageCrop?: { x: number; y: number; scale: number };

  @Prop()
  bannerImageUrl?: string;

  @Prop({ type: { x: Number, y: Number, scale: Number }, default: { x: 0, y: 0, scale: 1 } })
  bannerImageCrop?: { x: number; y: number; scale: number };

  @Prop()
  cardImageUrl?: string;

  @Prop({ type: { x: Number, y: Number, scale: Number }, default: { x: 0, y: 0, scale: 1 } })
  cardImageCrop?: { x: number; y: number; scale: number };

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

  @Prop({ enum: COURSE_APPROVAL_STATUS_VALUES, default: CourseApprovalStatus.Pending })
  approvalStatus: CourseApprovalStatus;

  @Prop()
  approvedAt?: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  approvedBy?: mongoose.Types.ObjectId;

  @Prop({ default: [], type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] })
  participants: mongoose.Types.ObjectId[];
}


export type CourseDocument = Course & Document;

export const CourseSchema = SchemaFactory.createForClass(Course);
