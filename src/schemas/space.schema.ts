import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DEFAULT_PAYMENT_METHODS, PaymentMethod, PAYMENT_METHOD_VALUES } from '../payments/payment-method.enum';

export type SpaceDocument = Space & Document;

export type SpaceRentalUnit = 'whole_room' | 'workstation';
export type SpaceRentalMode = 'time' | 'full_day';

export class SpaceOpeningSlot {
  day: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  maxConsecutiveTimeSlots: number;
}

export class SpaceExceptionalClosure {
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export type RecurringPaymentOption = 'full' | 'automatic';

export class SpaceSectorRecurringSetting {
  sectorIndex: number;
  enabled: boolean;
  paymentOptions: RecurringPaymentOption[];
  chargeAdvanceDays: number;
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
  maxConsecutiveTimeSlots: number;

  @Prop({ default: 1, min: 1 })
  workstationCount: number;

  @Prop({ default: false })
  sectorEnabled: boolean;

  @Prop({ default: 1, min: 1 })
  sectorCount: number;

  @Prop({ type: [String], default: [] })
  sectorNames: string[];

  @Prop({ default: '#dbeafe' })
  calendarColor: string;

  @Prop({ type: [String], default: [] })
  sectorColors: string[];

  @Prop({ default: 0, min: 0 })
  sectorRate: number;

  @Prop({ default: 0, min: 0 })
  sectorDailyRate: number;

  @Prop({ default: 2, min: 0 })
  courseCreationAdvanceHours: number;

  @Prop({ type: [String], enum: PAYMENT_METHOD_VALUES, default: DEFAULT_PAYMENT_METHODS })
  paymentMethods: PaymentMethod[];

  @Prop({ type: [String], enum: ['full', 'automatic'], default: ['full'] })
  recurringPaymentOptions: RecurringPaymentOption[];

  @Prop({ default: false })
  recurringEnabled: boolean;

  @Prop({ default: 7, min: 1, max: 90 })
  recurringChargeAdvanceDays: number;

  @Prop({
    type: [{
      sectorIndex: { type: Number, required: true, min: 0 },
      enabled: { type: Boolean, default: false },
      paymentOptions: { type: [String], enum: ['full', 'automatic'], default: ['full'] },
      chargeAdvanceDays: { type: Number, default: 7, min: 1, max: 90 },
    }],
    default: [],
  })
  sectorRecurringSettings: SpaceSectorRecurringSetting[];

  @Prop({
    type: [{
      day: { type: Number, min: 0, max: 6, required: true },
      isOpen: { type: Boolean, default: true },
      openTime: { type: String, default: '09:00' },
      closeTime: { type: String, default: '18:00' },
      maxConsecutiveTimeSlots: { type: Number, default: 1, min: 1 },
    }],
    default: [
      { day: 0, isOpen: false, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 1, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 2, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 3, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 4, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 5, isOpen: true, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
      { day: 6, isOpen: false, openTime: '09:00', closeTime: '18:00', maxConsecutiveTimeSlots: 1 },
    ],
  })
  openingHours: SpaceOpeningSlot[];

  @Prop({
    type: [{
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reason: { type: String },
    }],
    default: [],
  })
  exceptionalClosures: SpaceExceptionalClosure[];

  @Prop({ default: true })
  isAvailable: boolean;
}

export const SpaceSchema = SchemaFactory.createForClass(Space);
