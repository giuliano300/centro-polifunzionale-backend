import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SystemSettings extends Document {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true, default: 0, min: 0 })
  newUserWalletCredit: number;

  @Prop({ required: true, default: 0, min: 0 })
  newClientWalletCredit: number;

  @Prop({ required: true, default: 0, min: 0 })
  newManagerWalletCredit: number;

  @Prop({ required: true, default: 15, min: 1, max: 120 })
  bookingHoldMinutes: number;
}

export type SystemSettingsDocument = SystemSettings & Document;
export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
