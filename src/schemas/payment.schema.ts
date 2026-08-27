import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Payment extends Document {
 @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true })
 bookingId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, default: 0 })
  totalAmount: number;

  @Prop({ required: true, default: 0 })
  walletAmount: number;

  @Prop({ required: true, default: 0 })
  externalAmount: number;

  @Prop({ default: 0 })
  originalAmount: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop()
  discountCode?: string;

  @Prop({ required: true, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' })
  status: 'PENDING' | 'PAID' | 'FAILED';

  @Prop()
  method: string; // es: 'cash', 'card', 'paypal'

  @Prop()
  transactionId?: string;

  @Prop({ enum: ['manual', 'stripe', 'paypal', 'nexi'], default: 'manual' })
  provider?: 'manual' | 'stripe' | 'paypal' | 'nexi';

  @Prop()
  checkoutUrl?: string;

  @Prop()
  providerPayload?: string;

  @Prop({ index: true })
  seriesId?: string;

  @Prop({ default: false })
  automaticCharge?: boolean;

  @Prop({ type: Date, index: true })
  dueDate?: Date;

  @Prop()
  stripeCustomerId?: string;

  @Prop()
  stripePaymentMethodId?: string;
}

export type PaymentDocument = Payment & Document;
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });
