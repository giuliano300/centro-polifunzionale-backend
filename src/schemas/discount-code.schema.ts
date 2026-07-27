import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import mongoose from 'mongoose';

export type DiscountCodeDocument = DiscountCode & Document;

@Schema({ timestamps: true })
export class DiscountCode {
  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ trim: true })
  title?: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: false })
  isAutomatic: boolean;

  @Prop({ required: true, enum: ['percentage', 'fixed'] })
  type: 'percentage' | 'fixed';

  @Prop({ required: true, min: 0 })
  value: number;

  @Prop({ required: true, enum: ['all', 'booking', 'course'], default: 'all' })
  target: 'all' | 'booking' | 'course';

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Space' }], default: [] })
  spaces: mongoose.Types.ObjectId[];

  @Prop({ type: [String], enum: ['admin', 'gestore', 'cliente'], default: [] })
  userRoles: string[];

  @Prop({ required: true, enum: ['manual', 'new_user', 'monthly_purchases'], default: 'manual' })
  rule: 'manual' | 'new_user' | 'monthly_purchases';

  @Prop({ default: 30, min: 1 })
  newUserDays: number;

  @Prop({ default: 0, min: 0 })
  monthlyPurchaseMin: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  validFrom?: Date;

  @Prop()
  validTo?: Date;

  @Prop({ min: 0 })
  maxUses?: number;

  @Prop({ default: 0, min: 0 })
  usedCount: number;
}

export const DiscountCodeSchema = SchemaFactory.createForClass(DiscountCode);
