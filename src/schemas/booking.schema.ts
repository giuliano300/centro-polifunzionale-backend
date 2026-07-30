import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';
import { User } from './user.schema';
import { Space } from './space.schema';

@Schema({ timestamps: true })
export class Booking extends Document {
  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'User' })
  user: User;

  @Prop({ required: true, type: mongoose.Schema.Types.ObjectId, ref: 'Space' })
  space: Space;

  @Prop({ required: true, type: Date })
  date: Date;

  @Prop({ required: true })
  name?: string;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  @Prop({ required: true, enum: ['whole_room', 'workstation'], default: 'whole_room' })
  rentalUnit: 'whole_room' | 'workstation';

  @Prop({ required: true, enum: ['time', 'full_day'], default: 'time' })
  rentalMode: 'time' | 'full_day';

  @Prop({ default: 1, min: 1 })
  workstationQuantity: number;

  @Prop({ default: 0, min: 0 })
  sectorQuantity: number;

  @Prop({ type: [Number], default: [] })
  sectorIndexes: number[];

  @Prop({ default: 'pending', enum: ['pending', 'confirmed', 'cancellation_requested', 'cancelled'] })
  status: 'pending' | 'confirmed' | 'cancellation_requested' | 'cancelled';

}

export type BookingDocument = Booking & Document;
export const BookingSchema = SchemaFactory.createForClass(Booking);
