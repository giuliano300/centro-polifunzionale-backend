import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ManagerRegistrationOtpDocument = ManagerRegistrationOtp & Document;

@Schema({ timestamps: true })
export class ManagerRegistrationOtp {
  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, uppercase: true, trim: true })
  taxCode: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  acceptedDataProcessingAt: Date;

  @Prop({ required: true })
  requestedAt: Date;

  @Prop({ required: true })
  emailOtpHash: string;

  @Prop({ required: true })
  phoneOtpHash: string;

  @Prop({ required: true, default: 0 })
  attempts: number;

  @Prop({ required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const ManagerRegistrationOtpSchema = SchemaFactory.createForClass(ManagerRegistrationOtp);
