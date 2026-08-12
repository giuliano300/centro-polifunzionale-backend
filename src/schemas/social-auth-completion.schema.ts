import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SocialAuthCompletionDocument = SocialAuthCompletion & Document;

@Schema({ timestamps: true })
export class SocialAuthCompletion {
  @Prop({ required: true, unique: true })
  jti: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  phoneOtpHash: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: false })
  used: boolean;

  @Prop()
  lastOtpRequestedAt?: Date;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}

export const SocialAuthCompletionSchema = SchemaFactory.createForClass(SocialAuthCompletion);
