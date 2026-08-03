import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document } from 'mongoose';

@Schema({ timestamps: true })
export class PushSubscription extends Document {
  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }) user: mongoose.Types.ObjectId;
  @Prop({ required: true, unique: true }) endpoint: string;
  @Prop({ required: true }) p256dh: string;
  @Prop({ required: true }) auth: string;
}
export const PushSubscriptionSchema = SchemaFactory.createForClass(PushSubscription);
