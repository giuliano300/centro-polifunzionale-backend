import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SpaceDocument = Space & Document;

export type SpaceRentalUnit = 'whole_room' | 'workstation';
export type SpaceRentalMode = 'time' | 'full_day';

export class SpaceOpeningSlot {
  day: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

@Schema()
export class Space {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  hourlyRate: number;

  @Prop({ default: 0 })
  dailyRate: number;

  @Prop({ required: true, enum: ['whole_room', 'workstation'], default: 'whole_room' })
  rentalUnit: SpaceRentalUnit;

  @Prop({ type: [String], enum: ['time', 'full_day'], default: ['time'] })
  rentalModes: SpaceRentalMode[];

  @Prop({ default: 60, min: 15 })
  timeSlotMinutes: number;

  @Prop({ default: 1, min: 1 })
  workstationCount: number;

  @Prop({
    type: [{
      day: { type: Number, min: 0, max: 6, required: true },
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '18:00' },
    }],
    default: [
      { day: 0, isOpen: false, openTime: '09:00', closeTime: '18:00' },
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '18:00' },
      { day: 6, isOpen: false, openTime: '09:00', closeTime: '18:00' },
    ],
  })
  openingHours: SpaceOpeningSlot[];

  @Prop({ default: true })
  isAvailable: boolean;
}

export const SpaceSchema = SchemaFactory.createForClass(Space);
